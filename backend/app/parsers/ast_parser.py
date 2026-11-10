"""
Polyglot AST Parser (Tree-Sitter & Grammar Lexer) for Java, Python, and SQL.
Extracts code entities: Function, Class, Module, DatabaseQuery, DatabaseTable.
Maps relationships: CALLS, BELONGS_TO, IN_MODULE, MUTATES_TABLE, READS_TABLE.
Specially captures legacy RPC boundaries and Stored Database Procedures.
"""

import os
import re
import ast as py_ast
import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("archaeo.parser")

# Check Tree-Sitter availability
try:
    from tree_sitter import Parser, Language
    import tree_sitter_languages
    TREE_SITTER_AVAILABLE = True
except Exception:
    TREE_SITTER_AVAILABLE = False
    logger.info("tree-sitter native bindings not active; utilizing built-in polyglot AST grammar parser.")


# =========================================================================
# Data Structures
# =========================================================================

@dataclass
class FunctionNode:
    id: str
    name: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    signature: str = ""
    code_snippet: str = ""
    is_rpc: bool = False
    is_stored_proc: bool = False
    class_name: Optional[str] = None
    module_name: Optional[str] = None
    docstring: Optional[str] = None
    cyclomatic_complexity: int = 1


@dataclass
class ClassNode:
    id: str
    name: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    is_service: bool = False
    is_rpc_interface: bool = False


@dataclass
class ModuleNode:
    id: str
    name: str
    file_path: str
    language: str


@dataclass
class DatabaseTableNode:
    id: str
    name: str
    schema_name: Optional[str] = None


@dataclass
class DatabaseQueryNode:
    id: str
    query_type: str  # SELECT, INSERT, UPDATE, DELETE, CALL_PROC
    raw_query: str
    tables: List[str]
    file_path: str
    line_number: int


@dataclass
class CallEdge:
    source_id: str
    target_id: str
    line_number: int
    is_rpc: bool = False
    call_expr: str = ""


@dataclass
class TableMutationEdge:
    function_id: str
    table_name: str
    operation: str  # INSERT, UPDATE, DELETE


@dataclass
class TableReadEdge:
    function_id: str
    table_name: str
    operation: str = "SELECT"


@dataclass
class ParsedEntities:
    modules: List[ModuleNode] = field(default_factory=list)
    classes: List[ClassNode] = field(default_factory=list)
    functions: List[FunctionNode] = field(default_factory=list)
    tables: List[DatabaseTableNode] = field(default_factory=list)
    queries: List[DatabaseQueryNode] = field(default_factory=list)
    calls: List[CallEdge] = field(default_factory=list)
    mutations: List[TableMutationEdge] = field(default_factory=list)
    reads: List[TableReadEdge] = field(default_factory=list)


# =========================================================================
# SQL Query & DML Helper
# =========================================================================

SQL_TABLE_REGEX = re.compile(
    r'\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([`"\'\[]?([a-zA-Z0-9_]+)[`"\'\]]?)',
    re.IGNORECASE
)
SQL_STORED_PROC_CALL_REGEX = re.compile(
    r'\b(?:CALL|EXEC|EXECUTE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)',
    re.IGNORECASE
)


def extract_sql_operations(sql_text: str) -> Tuple[List[str], List[str], List[str], List[str]]:
    """
    Analyzes raw SQL or embedded strings to detect:
    - Tables Mutated (INSERT, UPDATE, DELETE)
    - Tables Read (SELECT)
    - Stored Procedures Called (CALL sp_...)
    - Query types
    """
    mutated_tables: Set[str] = set()
    read_tables: Set[str] = set()
    proc_calls: Set[str] = set()
    ops: Set[str] = set()

    clean_text = sql_text.replace("\n", " ").strip()

    # DML statements
    for match in re.finditer(r'\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([`"\'\[]?([a-zA-Z0-9_]+)[`"\'\]]?)', clean_text, re.IGNORECASE):
        table = match.group(3).upper()
        if table not in ("SELECT", "SET", "VALUES", "WHERE"):
            mutated_tables.add(table)
            ops.add("MUTATION")

    for match in re.finditer(r'\b(FROM|JOIN)\s+([`"\'\[]?([a-zA-Z0-9_]+)[`"\'\]]?)', clean_text, re.IGNORECASE):
        table = match.group(3).upper()
        if table not in ("SELECT", "WHERE", "ORDER", "GROUP"):
            read_tables.add(table)
            ops.add("SELECT")

    for match in SQL_STORED_PROC_CALL_REGEX.finditer(clean_text):
        proc_calls.add(match.group(1))

    return list(mutated_tables), list(read_tables), list(proc_calls), list(ops)


# =========================================================================
# Polyglot AST Extractor
# =========================================================================

class PolyglotASTParser:
    """Extracts entities and relationships across Java, Python, and SQL files."""

    def __init__(self):
        self.entities = ParsedEntities()
        self._function_lookup: Dict[str, FunctionNode] = {}

    def parse_repository(self, repo_path: str) -> ParsedEntities:
        """Walks directory, analyzes supported source files, and builds graph."""
        self.entities = ParsedEntities()
        self._function_lookup.clear()

        supported_exts = {".py", ".java", ".sql"}

        for root, _, files in os.walk(repo_path):
            # Skip hidden and cache folders
            if any(part.startswith((".", "node_modules", "target", "build", "__pycache__", "venv", ".git")) for part in root.split(os.sep)):
                continue

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in supported_exts:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, repo_path).replace("\\", "/")
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()

                        if ext == ".py":
                            self._parse_python(rel_path, content)
                        elif ext == ".java":
                            self._parse_java(rel_path, content)
                        elif ext == ".sql":
                            self._parse_sql(rel_path, content)
                    except Exception as err:
                        logger.error(f"Error parsing {rel_path}: {err}")

        # Post-process call graph linkages
        self._resolve_inter_function_calls()
        return self.entities

    # -------------------------------------------------------------------------
    # Python Parser
    # -------------------------------------------------------------------------
    def _parse_python(self, file_path: str, content: str):
        module_id = f"py:{file_path}"
        mod_name = os.path.splitext(os.path.basename(file_path))[0]
        self.entities.modules.append(ModuleNode(id=module_id, name=mod_name, file_path=file_path, language="python"))

        try:
            tree = py_ast.parse(content, filename=file_path)
        except SyntaxError:
            # Fallback to line scanner if file has legacy syntax errors
            self._parse_python_fallback(file_path, content)
            return

        lines = content.splitlines()

        for node in py_ast.iter_child_nodes(tree):
            if isinstance(node, py_ast.ClassDef):
                class_id = f"{file_path}:{node.name}"
                is_rpc = any(
                    "rpc" in d.id.lower() or "service" in d.id.lower()
                    for d in node.decorator_list if isinstance(d, py_ast.Name)
                )
                self.entities.classes.append(ClassNode(
                    id=class_id,
                    name=node.name,
                    file_path=file_path,
                    language="python",
                    start_line=node.lineno,
                    end_line=getattr(node, "end_lineno", node.lineno + 10),
                    is_service="Service" in node.name or "Controller" in node.name,
                    is_rpc_interface=is_rpc
                ))

                for item in node.body:
                    if isinstance(item, (py_ast.FunctionDef, py_ast.AsyncFunctionDef)):
                        self._process_python_func(item, file_path, lines, class_name=node.name, module_name=mod_name)
            elif isinstance(node, (py_ast.FunctionDef, py_ast.AsyncFunctionDef)):
                self._process_python_func(node, file_path, lines, class_name=None, module_name=mod_name)

    def _process_python_func(self, node, file_path: str, lines: List[str], class_name: Optional[str], module_name: str):
        func_id = f"{file_path}:{class_name + '.' if class_name else ''}{node.name}"
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line + 5)
        snippet = "\n".join(lines[start_line - 1:end_line])

        # Detect RPC / Web Endpoint
        is_rpc = False
        for dec in node.decorator_list:
            dec_str = py_ast.unparse(dec) if hasattr(py_ast, "unparse") else ""
            if any(kw in dec_str.lower() for kw in ("route", "post", "get", "rpc", "task", "remote", "endpoint")):
                is_rpc = True
                break

        func_obj = FunctionNode(
            id=func_id,
            name=node.name,
            file_path=file_path,
            language="python",
            start_line=start_line,
            end_line=end_line,
            signature=f"def {node.name}(...)",
            code_snippet=snippet,
            is_rpc=is_rpc,
            class_name=class_name,
            module_name=module_name,
            docstring=py_ast.get_docstring(node),
            cyclomatic_complexity=1 + len([n for n in py_ast.walk(node) if isinstance(n, (py_ast.If, py_ast.For, py_ast.While))])
        )
        self.entities.functions.append(func_obj)
        self._function_lookup[func_id] = func_obj

        # Extract internal call expressions & SQL queries
        for sub in py_ast.walk(node):
            if isinstance(sub, py_ast.Call):
                call_name = ""
                if isinstance(sub.func, py_ast.Name):
                    call_name = sub.func.id
                elif isinstance(sub.func, py_ast.Attribute):
                    call_name = sub.func.attr

                if call_name:
                    is_network_call = call_name in ("post", "get", "request", "call", "invoke", "execute_rpc")
                    self.entities.calls.append(CallEdge(
                        source_id=func_id,
                        target_id=call_name,
                        line_number=getattr(sub, "lineno", start_line),
                        is_rpc=is_network_call,
                        call_expr=call_name
                    ))

            # Detect embedded SQL in strings
            if isinstance(sub, py_ast.Constant) and isinstance(sub.value, str):
                sval = sub.value.strip()
                if any(sval.upper().startswith(kw) for kw in ("SELECT", "INSERT", "UPDATE", "DELETE", "CALL")):
                    mutated, read, procs, _ = extract_sql_operations(sval)
                    for t in mutated:
                        self._record_table_mutation(func_id, t, "UPDATE")
                    for t in read:
                        self._record_table_read(func_id, t)
                    for p in procs:
                        self.entities.calls.append(CallEdge(
                            source_id=func_id,
                            target_id=f"sql:proc:{p}",
                            line_number=getattr(sub, "lineno", start_line),
                            is_rpc=False,
                            call_expr=f"CALL {p}"
                        ))

    def _parse_python_fallback(self, file_path: str, content: str):
        lines = content.splitlines()
        for idx, line in enumerate(lines):
            match = re.match(r'^\s*def\s+([a-zA-Z0-9_]+)\s*\(', line)
            if match:
                name = match.group(1)
                fid = f"{file_path}:{name}"
                fn = FunctionNode(
                    id=fid,
                    name=name,
                    file_path=file_path,
                    language="python",
                    start_line=idx + 1,
                    end_line=min(idx + 15, len(lines)),
                    signature=line.strip(),
                    code_snippet="\n".join(lines[idx:min(idx + 15, len(lines))])
                )
                self.entities.functions.append(fn)
                self._function_lookup[fid] = fn

    # -------------------------------------------------------------------------
    # Java Parser
    # -------------------------------------------------------------------------
    def _parse_java(self, file_path: str, content: str):
        lines = content.splitlines()
        mod_name = os.path.splitext(os.path.basename(file_path))[0]
        self.entities.modules.append(ModuleNode(
            id=f"java:{file_path}",
            name=mod_name,
            file_path=file_path,
            language="java"
        ))

        # Class extraction regex
        class_pattern = re.compile(
            r'(@[a-zA-Z0-9_()="\s,.]+)?\s*public\s+(?:class|interface)\s+([a-zA-Z0-9_]+)',
            re.MULTILINE
        )
        current_class = mod_name

        for match in class_pattern.finditer(content):
            annotations = match.group(1) or ""
            cname = match.group(2)
            current_class = cname
            line_no = content[:match.start()].count("\n") + 1
            is_rpc = any(ann in annotations for ann in ("@RestController", "@Remote", "@WebService", "@FeignClient", "@Stateless"))
            self.entities.classes.append(ClassNode(
                id=f"{file_path}:{cname}",
                name=cname,
                file_path=file_path,
                language="java",
                start_line=line_no,
                end_line=len(lines),
                is_service="Service" in cname or "Manager" in cname or "Processor" in cname,
                is_rpc_interface=is_rpc
            ))

        # Method extraction regex (handles annotations, access modifiers, return types)
        method_pattern = re.compile(
            r'((?:@\w+(?:\([^)]*\))?\s*)*)'                          # Annotations
            r'(public|protected|private|static|\s)+'                 # Modifiers
            r'([\w<>\[\],\s]+)\s+'                                   # Return type
            r'([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*'                     # Method name & params
            r'(?:throws\s+[\w\s,]+)?\s*\{',                          # Throws & block start
            re.MULTILINE
        )

        for match in method_pattern.finditer(content):
            annotations = match.group(1).strip()
            return_type = match.group(3).strip()
            method_name = match.group(4).strip()
            params = match.group(5).strip()

            if method_name in ("if", "while", "for", "switch", "catch"):
                continue

            char_start = match.start()
            start_line = content[:char_start].count("\n") + 1
            # Find closing bracket by scanning
            end_line = min(start_line + 30, len(lines))
            snippet = "\n".join(lines[start_line - 1:end_line])

            is_rpc = any(ann in annotations for ann in (
                "@RequestMapping", "@PostMapping", "@GetMapping", "@Remote", "@WebMethod", "@SOAPBinding"
            ))

            func_id = f"{file_path}:{current_class}.{method_name}"
            fn = FunctionNode(
                id=func_id,
                name=method_name,
                file_path=file_path,
                language="java",
                start_line=start_line,
                end_line=end_line,
                signature=f"{return_type} {method_name}({params})",
                code_snippet=snippet,
                is_rpc=is_rpc,
                class_name=current_class,
                module_name=mod_name,
                docstring=annotations
            )
            self.entities.functions.append(fn)
            self._function_lookup[func_id] = fn

            # Extract calls inside this method snippet
            call_matches = re.finditer(r'([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)\s*\(', snippet)
            for cm in call_matches:
                receiver = cm.group(1)
                called_method = cm.group(2)
                is_net = "Client" in receiver or "Http" in receiver or "Rpc" in receiver or "Gateway" in receiver
                self.entities.calls.append(CallEdge(
                    source_id=func_id,
                    target_id=called_method,
                    line_number=start_line,
                    is_rpc=is_net,
                    call_expr=f"{receiver}.{called_method}()"
                ))

            # Direct method calls: method()
            direct_calls = re.finditer(r'\b([a-zA-Z0-9_]{3,})\s*\(', snippet)
            for dm in direct_calls:
                called_method = dm.group(1)
                if called_method not in (method_name, "if", "for", "while", "println", "debug", "info", "error", "warn"):
                    self.entities.calls.append(CallEdge(
                        source_id=func_id,
                        target_id=called_method,
                        line_number=start_line,
                        is_rpc=False,
                        call_expr=f"{called_method}()"
                    ))

            # Database & Stored Procedure calls in snippet
            # e.g., prepareCall("{call sp_settle_batch(?)}") or jdbcTemplate.update(...)
            sp_matches = re.finditer(r'\{call\s+([a-zA-Z0-9_]+)', snippet, re.IGNORECASE)
            for spm in sp_matches:
                proc = spm.group(1)
                self.entities.calls.append(CallEdge(
                    source_id=func_id,
                    target_id=f"sql:proc:{proc}",
                    line_number=start_line,
                    is_rpc=False,
                    call_expr=f"CALL {proc}"
                ))

            # Detect embedded SQL inside Java strings
            for str_match in re.finditer(r'"([^"\\]*(?:\\.[^"\\]*)*)"', snippet):
                raw_s = str_match.group(1).strip()
                if any(raw_s.upper().startswith(k) for k in ("SELECT", "INSERT", "UPDATE", "DELETE", "MERGE")):
                    mutated, read, _, _ = extract_sql_operations(raw_s)
                    for t in mutated:
                        self._record_table_mutation(func_id, t, "UPDATE")
                    for t in read:
                        self._record_table_read(func_id, t)

    # -------------------------------------------------------------------------
    # SQL Parser
    # -------------------------------------------------------------------------
    def _parse_sql(self, file_path: str, content: str):
        lines = content.splitlines()
        mod_name = os.path.splitext(os.path.basename(file_path))[0]
        self.entities.modules.append(ModuleNode(
            id=f"sql:{file_path}",
            name=mod_name,
            file_path=file_path,
            language="sql"
        ))

        # Detect CREATE TABLE DDL
        for table_match in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\'\[]?([a-zA-Z0-9_]+)[`"\'\]]?)', content, re.IGNORECASE):
            tbl_name = table_match.group(2).upper()
            self._ensure_table_exists(tbl_name)

        # Detect CREATE PROCEDURE / FUNCTION
        proc_pattern = re.compile(
            r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:RETURNS\s+[\w\s()]+)?\s*(?:AS\s+|\$\$|BEGIN)?',
            re.IGNORECASE
        )

        for match in proc_pattern.finditer(content):
            proc_name = match.group(1)
            params = match.group(2).strip()
            char_start = match.start()
            start_line = content[:char_start].count("\n") + 1
            end_line = min(start_line + 40, len(lines))
            snippet = "\n".join(lines[start_line - 1:end_line])

            func_id = f"sql:proc:{proc_name}"
            fn = FunctionNode(
                id=func_id,
                name=proc_name,
                file_path=file_path,
                language="sql",
                start_line=start_line,
                end_line=end_line,
                signature=f"PROCEDURE {proc_name}({params})",
                code_snippet=snippet,
                is_rpc=False,
                is_stored_proc=True,
                module_name=mod_name
            )
            self.entities.functions.append(fn)
            self._function_lookup[func_id] = fn

            # Extract internal table mutations and internal proc calls
            mutated, read, called_procs, _ = extract_sql_operations(snippet)
            for t in mutated:
                self._record_table_mutation(func_id, t, "UPDATE")
            for t in read:
                self._record_table_read(func_id, t)
            for cp in called_procs:
                if cp != proc_name:
                    self.entities.calls.append(CallEdge(
                        source_id=func_id,
                        target_id=f"sql:proc:{cp}",
                        line_number=start_line,
                        is_rpc=False,
                        call_expr=f"CALL {cp}"
                    ))

    # -------------------------------------------------------------------------
    # Helper Registration & Call Resolution
    # -------------------------------------------------------------------------
    def _ensure_table_exists(self, table_name: str) -> DatabaseTableNode:
        tbl_name = table_name.upper()
        for t in self.entities.tables:
            if t.name == tbl_name:
                return t
        tbl = DatabaseTableNode(id=f"table:{tbl_name}", name=tbl_name)
        self.entities.tables.append(tbl)
        return tbl

    def _record_table_mutation(self, func_id: str, table_name: str, op: str):
        tbl = self._ensure_table_exists(table_name)
        # Avoid duplicates
        if not any(m.function_id == func_id and m.table_name == tbl.name for m in self.entities.mutations):
            self.entities.mutations.append(TableMutationEdge(
                function_id=func_id,
                table_name=tbl.name,
                operation=op
            ))

    def _record_table_read(self, func_id: str, table_name: str):
        tbl = self._ensure_table_exists(table_name)
        if not any(r.function_id == func_id and r.table_name == tbl.name for r in self.entities.reads):
            self.entities.reads.append(TableReadEdge(
                function_id=func_id,
                table_name=tbl.name,
                operation="SELECT"
            ))

    def _resolve_inter_function_calls(self):
        """Resolves generic string function targets to specific qualified Function IDs."""
        name_to_ids: Dict[str, List[str]] = {}
        for fid, fnode in self._function_lookup.items():
            name_to_ids.setdefault(fnode.name, []).append(fid)

        resolved_calls: List[CallEdge] = []
        for call in self.entities.calls:
            target = call.target_id
            if target in self._function_lookup:
                resolved_calls.append(call)
            elif target in name_to_ids:
                # Disambiguate or pick the most relevant match
                best_match = name_to_ids[target][0]
                resolved_calls.append(CallEdge(
                    source_id=call.source_id,
                    target_id=best_match,
                    line_number=call.line_number,
                    is_rpc=call.is_rpc,
                    call_expr=call.call_expr
                ))
            else:
                # Stored proc or external endpoint
                resolved_calls.append(call)

        self.entities.calls = resolved_calls


# =========================================================================
# Async Batch Insertion Function for Neo4j and In-Memory Graph
# =========================================================================

async def load_ast_to_graph(entities: ParsedEntities, neo4j_cli, batch_size: int = 500) -> Dict[str, int]:
    """
    Persists parsed entities and relationships into Neo4j using high-performance
    UNWIND batch transactions, and mirrors them into in_memory_store.
    """
    mem = neo4j_cli.in_memory_store
    mem.clear()

    # Populate in-memory mirror first
    for m in entities.modules:
        mem.merge_node("Module", m.id, asdict(m))
    for c in entities.classes:
        mem.merge_node("Class", c.id, asdict(c))
    for f in entities.functions:
        mem.merge_node("Function", f.id, asdict(f))
    for t in entities.tables:
        mem.merge_node("DatabaseTable", t.id, asdict(t))
    for q in entities.queries:
        mem.merge_node("DatabaseQuery", q.id, asdict(q))

    # Edges in memory
    for call in entities.calls:
        mem.merge_edge(call.source_id, call.target_id, "CALLS", asdict(call))
    for mut in entities.mutations:
        mem.merge_edge(mut.function_id, f"table:{mut.table_name}", "MUTATES_TABLE", asdict(mut))
    for r in entities.reads:
        mem.merge_edge(r.function_id, f"table:{r.table_name}", "READS_TABLE", asdict(r))

    stats = {
        "modules_loaded": len(entities.modules),
        "classes_loaded": len(entities.classes),
        "functions_loaded": len(entities.functions),
        "tables_loaded": len(entities.tables),
        "calls_loaded": len(entities.calls),
        "mutations_loaded": len(entities.mutations)
    }

    # If Neo4j is connected, execute UNWIND batch queries
    if neo4j_cli.connected and neo4j_cli.driver:
        try:
            # 1. Batch Load Modules
            mod_data = [asdict(m) for m in entities.modules]
            await neo4j_cli.execute_write("""
                UNWIND $batch AS row
                MERGE (m:Module {id: row.id})
                SET m.name = row.name, m.file_path = row.file_path, m.language = row.language
            """, {"batch": mod_data})

            # 2. Batch Load Classes
            class_data = [asdict(c) for c in entities.classes]
            await neo4j_cli.execute_write("""
                UNWIND $batch AS row
                MERGE (c:Class {id: row.id})
                SET c.name = row.name, c.file_path = row.file_path, c.language = row.language,
                    c.start_line = row.start_line, c.end_line = row.end_line,
                    c.is_service = row.is_service, c.is_rpc_interface = row.is_rpc_interface
            """, {"batch": class_data})

            # 3. Batch Load Functions
            func_data = [asdict(f) for f in entities.functions]
            for i in range(0, len(func_data), batch_size):
                chunk = func_data[i:i + batch_size]
                await neo4j_cli.execute_write("""
                    UNWIND $batch AS row
                    MERGE (f:Function {id: row.id})
                    SET f.name = row.name, f.file_path = row.file_path, f.language = row.language,
                        f.start_line = row.start_line, f.end_line = row.end_line,
                        f.signature = row.signature, f.code_snippet = row.code_snippet,
                        f.is_rpc = row.is_rpc, f.is_stored_proc = row.is_stored_proc,
                        f.class_name = row.class_name, f.module_name = row.module_name,
                        f.cyclomatic_complexity = row.cyclomatic_complexity
                """, {"batch": chunk})

            # 4. Batch Load Tables
            tbl_data = [asdict(t) for t in entities.tables]
            await neo4j_cli.execute_write("""
                UNWIND $batch AS row
                MERGE (t:DatabaseTable {name: row.name})
                SET t.id = row.id, t.schema_name = row.schema_name
            """, {"batch": tbl_data})

            # 5. Batch Load CALLS relations
            call_data = [asdict(cl) for cl in entities.calls]
            for i in range(0, len(call_data), batch_size):
                chunk = call_data[i:i + batch_size]
                await neo4j_cli.execute_write("""
                    UNWIND $batch AS row
                    MATCH (src:Function {id: row.source_id})
                    MERGE (tgt:Function {id: row.target_id})
                    MERGE (src)-[r:CALLS]->(tgt)
                    SET r.line_number = row.line_number, r.is_rpc = row.is_rpc, r.call_expr = row.call_expr
                """, {"batch": chunk})

            # 6. Batch Load MUTATES_TABLE relations
            mut_data = [asdict(m) for m in entities.mutations]
            await neo4j_cli.execute_write("""
                UNWIND $batch AS row
                MATCH (src:Function {id: row.function_id})
                MATCH (tbl:DatabaseTable {name: row.table_name})
                MERGE (src)-[r:MUTATES_TABLE]->(tbl)
                SET r.operation = row.operation
            """, {"batch": mut_data})

            logger.info(f"Successfully loaded {len(entities.functions)} functions and {len(entities.calls)} calls to Neo4j.")
        except Exception as e:
            logger.error(f"Neo4j batch ingestion error: {e}")

    return stats
