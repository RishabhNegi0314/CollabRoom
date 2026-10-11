// Intelligent code snippets, keywords, and pre-prompts library for Remix Code Workspace

export interface CodeSuggestion {
  label: string;
  insertText: string;
  detail: string;
  kind: "snippet" | "keyword" | "function" | "variable" | "ai";
  doc?: string;
}

export interface PrePromptTemplate {
  name: string;
  snippet: string;
  description: string;
  icon?: string;
}

// ─── 1. LANGUAGE SNIPPET DICTIONARY ──────────────────────────────────────────

export const LANGUAGE_SNIPPETS: Record<string, CodeSuggestion[]> = {
  python: [
    {
      label: "def",
      insertText: "def function_name(args):\n    \"\"\"Docstring\"\"\"\n    return None",
      detail: "snippet: define function",
      kind: "snippet",
      doc: "Define a new function with parameters and return value"
    },
    {
      label: "class",
      insertText: "class ClassName:\n    def __init__(self, name):\n        self.name = name\n\n    def display(self):\n        print(self.name)",
      detail: "snippet: class declaration",
      kind: "snippet",
      doc: "Create an object-oriented class with constructor"
    },
    {
      label: "for",
      insertText: "for item in items:\n    print(item)",
      detail: "snippet: for in loop",
      kind: "snippet",
      doc: "Iterate over an iterable list or range"
    },
    {
      label: "for_range",
      insertText: "for i in range(10):\n    print(i)",
      detail: "snippet: for range loop",
      kind: "snippet",
      doc: "Counted loop using range(n)"
    },
    {
      label: "while",
      insertText: "while condition:\n    # loop body\n    pass",
      detail: "snippet: while loop",
      kind: "snippet",
      doc: "Execute loop while boolean condition is true"
    },
    {
      label: "if",
      insertText: "if condition:\n    pass\nelif other_condition:\n    pass\nelse:\n    pass",
      detail: "snippet: if-elif-else",
      kind: "snippet",
      doc: "Conditional branch statement"
    },
    {
      label: "try",
      insertText: "try:\n    # guarded code\n    pass\nexcept Exception as e:\n    print(f\"An error occurred: {e}\")",
      detail: "snippet: try-except block",
      kind: "snippet",
      doc: "Catch and handle runtime exceptions"
    },
    {
      label: "main",
      insertText: "if __name__ == \"__main__\":\n    print(\"Starting program...\")\n    # entry point code",
      detail: "snippet: __main__ entry",
      kind: "snippet",
      doc: "Standard Python executable entry point guard"
    },
    {
      label: "print",
      insertText: "print(f\"Value: {value}\")",
      detail: "snippet: formatted print",
      kind: "snippet",
      doc: "Print standard output with formatted f-string"
    },
    {
      label: "import",
      insertText: "import os\nimport sys",
      detail: "snippet: module import",
      kind: "snippet",
      doc: "Import standard library modules"
    },
    {
      label: "listcomp",
      insertText: "[x for x in iterable if condition]",
      detail: "snippet: list comprehension",
      kind: "snippet",
      doc: "Concise Python list comprehension expression"
    },
    {
      label: "with_open",
      insertText: "with open(\"data.txt\", \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n    print(content)",
      detail: "snippet: context file read",
      kind: "snippet",
      doc: "Safe context manager for opening and reading files"
    },
    {
      label: "dict",
      insertText: "data = {\n    \"name\": \"Remix\",\n    \"version\": 2.0,\n    \"active\": True\n}",
      detail: "snippet: dictionary structure",
      kind: "snippet",
      doc: "Create key-value dictionary mapping"
    }
  ],

  javascript: [
    {
      label: "function",
      insertText: "function calculateTotal(items) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price;\n  }\n  return total;\n}",
      detail: "snippet: function declaration",
      kind: "snippet",
      doc: "Declare a standard named JavaScript function"
    },
    {
      label: "arrow",
      insertText: "const processData = (input) => {\n  return input.trim().toLowerCase();\n};",
      detail: "snippet: arrow function",
      kind: "snippet",
      doc: "Define a modern ES6 arrow function expression"
    },
    {
      label: "async",
      insertText: "async function loadWorkspaceData(url) {\n  try {\n    const response = await fetch(url);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error(\"Failed to load:\", error);\n    throw error;\n  }\n}",
      detail: "snippet: async/await function",
      kind: "snippet",
      doc: "Asynchronous function with try-catch and fetch"
    },
    {
      label: "console.log",
      insertText: "console.log(\"[DEBUG]\", value);",
      detail: "snippet: console.log",
      kind: "snippet",
      doc: "Output debug information to stdout/terminal"
    },
    {
      label: "fetch",
      insertText: "const response = await fetch(\"/api/endpoint\", {\n  method: \"POST\",\n  headers: { \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({ key: \"value\" })\n});\nconst result = await response.json();",
      detail: "snippet: fetch POST request",
      kind: "snippet",
      doc: "Standard HTTP fetch API request with JSON payload"
    },
    {
      label: "try",
      insertText: "try {\n  // Protected execution\n} catch (error) {\n  console.error(\"Operation failed:\", error);\n}",
      detail: "snippet: try-catch block",
      kind: "snippet",
      doc: "Catch and handle synchronous runtime exceptions"
    },
    {
      label: "for",
      insertText: "for (let i = 0; i < array.length; i++) {\n  const item = array[i];\n  console.log(item);\n}",
      detail: "snippet: counted for loop",
      kind: "snippet",
      doc: "Indexed loop over an array"
    },
    {
      label: "forof",
      insertText: "for (const item of items) {\n  console.log(item);\n}",
      detail: "snippet: for...of loop",
      kind: "snippet",
      doc: "Iterate through elements of an array or iterable"
    },
    {
      label: "promise",
      insertText: "new Promise((resolve, reject) => {\n  setTimeout(() => resolve(\"Complete\"), 1000);\n})",
      detail: "snippet: new Promise",
      kind: "snippet",
      doc: "Create a new asynchronous Promise contract"
    },
    {
      label: "class",
      insertText: "class UserManager {\n  constructor(name) {\n    this.name = name;\n  }\n\n  greet() {\n    return `Hello, ${this.name}`;\n  }\n}",
      detail: "snippet: ES6 Class",
      kind: "snippet",
      doc: "Define an ES6 object-oriented class"
    },
    {
      label: "import",
      insertText: "import React, { useState, useEffect } from \"react\";",
      detail: "snippet: ES module import",
      kind: "snippet",
      doc: "Import named and default exports from module"
    }
  ],

  typescript: [
    {
      label: "interface",
      insertText: "interface UserProfile {\n  id: string;\n  name: string;\n  email: string;\n  isActive: boolean;\n  roles: string[];\n}",
      detail: "snippet: TypeScript interface",
      kind: "snippet",
      doc: "Declare structured object shape contract"
    },
    {
      label: "type",
      insertText: "type ActionStatus = \"idle\" | \"loading\" | \"success\" | \"error\";",
      detail: "snippet: union type alias",
      kind: "snippet",
      doc: "Define a TypeScript union or object type alias"
    },
    {
      label: "useState",
      insertText: "const [state, setState] = useState<string>(\"\");",
      detail: "snippet: React useState hook",
      kind: "snippet",
      doc: "Typed React state hook declaration"
    },
    {
      label: "useEffect",
      insertText: "useEffect(() => {\n  console.log(\"Component mounted\");\n  return () => {\n    // Cleanup\n  };\n}, []);",
      detail: "snippet: React useEffect hook",
      kind: "snippet",
      doc: "React lifecycle and subscription side-effect hook"
    },
    {
      label: "generic_function",
      insertText: "function wrapValue<T>(val: T): { data: T; timestamp: number } {\n  return { data: val, timestamp: Date.now() };\n}",
      detail: "snippet: generic function",
      kind: "snippet",
      doc: "Define type-safe generic reusable function"
    },
    {
      label: "async_typed",
      insertText: "async function fetchData<T>(endpoint: string): Promise<T> {\n  const res = await fetch(endpoint);\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json() as Promise<T>;\n}",
      detail: "snippet: typed async fetch",
      kind: "snippet",
      doc: "Fetch utility returning strongly typed Promise<T>"
    }
  ],

  java: [
    {
      label: "main",
      insertText: "public static void main(String[] args) {\n    System.out.println(\"Program initialized.\");\n}",
      detail: "snippet: main method",
      kind: "snippet",
      doc: "Java application executable entry point"
    },
    {
      label: "scanner",
      insertText: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextLine()) {\n            String input = sc.nextLine();\n            System.out.println(\"Input received: \" + input);\n        } else {\n            System.out.println(\"No input provided in Stdin.\");\n        }\n    }\n}",
      detail: "snippet: Java Scanner program",
      kind: "snippet",
      doc: "Complete runnable Java program with java.util.Scanner"
    },
    {
      label: "class",
      insertText: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java runtime!\");\n    }\n}",
      detail: "snippet: Java public class",
      kind: "snippet",
      doc: "Complete runnable Java class blueprint"
    },
    {
      label: "sysout",
      insertText: "System.out.println(\"Result: \" + result);",
      detail: "snippet: System.out.println",
      kind: "snippet",
      doc: "Print line to standard console output"
    },
    {
      label: "for",
      insertText: "for (int i = 0; i < 10; i++) {\n    System.out.println(i);\n}",
      detail: "snippet: standard for loop",
      kind: "snippet",
      doc: "Counted indexed loop iteration"
    },
    {
      label: "try",
      insertText: "try {\n    // code\n} catch (Exception e) {\n    e.printStackTrace();\n}",
      detail: "snippet: try-catch block",
      kind: "snippet",
      doc: "Exception handling block in Java"
    },
    {
      label: "list",
      insertText: "List<String> items = new ArrayList<>();\nitems.add(\"First\");\nitems.add(\"Second\");",
      detail: "snippet: ArrayList instantiation",
      kind: "snippet",
      doc: "Generic Java dynamic list creation"
    }
  ],

  cpp: [
    {
      label: "main",
      insertText: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}",
      detail: "snippet: C++ main program",
      kind: "snippet",
      doc: "Standard runnable C++ program boilerplate"
    },
    {
      label: "cout",
      insertText: "std::cout << \"Value: \" << x << std::endl;",
      detail: "snippet: std::cout stream",
      kind: "snippet",
      doc: "Stream output to console via standard output"
    },
    {
      label: "cin",
      insertText: "std::cin >> inputVariable;",
      detail: "snippet: std::cin stream",
      kind: "snippet",
      doc: "Stream input from console"
    },
    {
      label: "vector",
      insertText: "std::vector<int> numbers = {1, 2, 3, 4, 5};\nfor (const auto& num : numbers) {\n    std::cout << num << \" \";\n}\nstd::cout << std::endl;",
      detail: "snippet: std::vector loop",
      kind: "snippet",
      doc: "Modern STL vector collection and range-for loop"
    }
  ],

  html: [
    {
      label: "html5",
      insertText: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>Document</title>\n  <link rel=\"stylesheet\" href=\"styles.css\" />\n</head>\n<body>\n  <main class=\"container\">\n    <h1>Hello World</h1>\n  </main>\n  <script src=\"main.js\"></script>\n</body>\n</html>",
      detail: "snippet: HTML5 boilerplate",
      kind: "snippet",
      doc: "Full modern HTML5 responsive document template"
    },
    {
      label: "div",
      insertText: "<div class=\"flex items-center justify-between p-4\">\n  <span>Label</span>\n</div>",
      detail: "snippet: container div",
      kind: "snippet",
      doc: "Flex layout division container"
    },
    {
      label: "button",
      insertText: "<button type=\"button\" class=\"btn-primary\">\n  Click Me\n</button>",
      detail: "snippet: button element",
      kind: "snippet",
      doc: "Interactive button element"
    },
    {
      label: "input",
      insertText: "<input type=\"text\" placeholder=\"Enter text...\" class=\"input-field\" />",
      detail: "snippet: input element",
      kind: "snippet",
      doc: "Form input text field"
    }
  ],

  css: [
    {
      label: "flex_center",
      insertText: "display: flex;\nalign-items: center;\njustify-content: center;",
      detail: "snippet: center flexbox",
      kind: "snippet",
      doc: "Center children horizontally and vertically"
    },
    {
      label: "grid_cols",
      insertText: "display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\ngap: 1.5rem;",
      detail: "snippet: responsive grid",
      kind: "snippet",
      doc: "Responsive CSS grid with automatic columns"
    },
    {
      label: "glassmorphism",
      insertText: "background: rgba(15, 23, 42, 0.75);\nbackdrop-filter: blur(16px);\nborder: 1px solid rgba(255, 255, 255, 0.1);\nborder-radius: 1rem;\nbox-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);",
      detail: "snippet: glass card style",
      kind: "snippet",
      doc: "Futuristic frosted glass effect styling"
    }
  ]
};

// ─── 2. LANGUAGE KEYWORDS LISTS ──────────────────────────────────────────────

export const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  python: [
    "def", "class", "return", "import", "from", "as", "if", "elif", "else",
    "for", "while", "break", "continue", "try", "except", "finally", "with",
    "lambda", "yield", "raise", "assert", "global", "nonlocal", "pass",
    "True", "False", "None", "and", "or", "not", "is", "in", "async", "await"
  ],
  javascript: [
    "function", "const", "let", "var", "return", "if", "else", "switch", "case",
    "for", "while", "do", "break", "continue", "try", "catch", "finally", "throw",
    "class", "extends", "super", "this", "new", "import", "export", "default",
    "from", "as", "async", "await", "yield", "typeof", "instanceof", "null", "undefined", "true", "false"
  ],
  typescript: [
    "interface", "type", "enum", "implements", "namespace", "declare", "abstract",
    "readonly", "keyof", "typeof", "as", "is", "never", "unknown", "any", "void",
    "function", "const", "let", "return", "if", "else", "for", "while", "class",
    "async", "await", "import", "export"
  ],
  java: [
    "public", "private", "protected", "static", "final", "abstract", "class",
    "interface", "extends", "implements", "void", "int", "boolean", "double",
    "String", "return", "if", "else", "for", "while", "switch", "case", "try",
    "catch", "finally", "throw", "throws", "new", "this", "super", "package", "import"
  ],
  cpp: [
    "int", "double", "float", "char", "bool", "void", "auto", "const", "constexpr",
    "class", "struct", "public", "private", "protected", "virtual", "override",
    "template", "typename", "namespace", "using", "return", "if", "else", "for",
    "while", "switch", "case", "try", "catch", "throw", "new", "delete", "include"
  ],
  html: [
    "div", "span", "p", "h1", "h2", "h3", "button", "input", "form", "section",
    "header", "footer", "main", "nav", "article", "ul", "ol", "li", "table", "a"
  ],
  css: [
    "display", "position", "flex", "grid", "margin", "padding", "width", "height",
    "background", "color", "border", "border-radius", "font-family", "font-size",
    "font-weight", "align-items", "justify-content", "gap", "box-shadow", "transform", "transition"
  ]
};

// ─── 3. QUICK PRE-PROMPT TOOLBAR ITEMS ───────────────────────────────────────

export const QUICK_PRE_PROMPTS: Record<string, PrePromptTemplate[]> = {
  python: [
    { name: "+ Function", snippet: "def ${1:func_name}(${2:params}):\n    ${3:pass}\n", description: "Function definition" },
    { name: "+ Class", snippet: "class ${1:ClassName}:\n    def __init__(self):\n        ${2:pass}\n", description: "Class constructor" },
    { name: "+ For Loop", snippet: "for ${1:item} in ${2:items}:\n    ${3:print(item)}\n", description: "Iterate loop" },
    { name: "+ Try / Except", snippet: "try:\n    ${1:pass}\nexcept Exception as e:\n    print(f\"Error: {e}\")\n", description: "Error handler" },
    { name: "+ Print F-String", snippet: "print(f\"[LOG] {${1:value}}\")\n", description: "Debug print" },
    { name: "+ Entry Guard", snippet: "if __name__ == \"__main__\":\n    ${1:main()}\n", description: "Main entry" }
  ],
  javascript: [
    { name: "+ Function", snippet: "function ${1:funcName}(${2:params}) {\n  ${3:// code}\n}\n", description: "Named function" },
    { name: "+ Arrow Func", snippet: "const ${1:funcName} = (${2:params}) => {\n  ${3:// code}\n};\n", description: "Arrow function" },
    { name: "+ Async Fetch", snippet: "async function ${1:loadData}() {\n  const res = await fetch(\"${2:/api/data}\");\n  const data = await res.json();\n  return data;\n}\n", description: "Async fetch" },
    { name: "+ Try / Catch", snippet: "try {\n  ${1:// code}\n} catch (error) {\n  console.error(error);\n}\n", description: "Try catch" },
    { name: "+ Console.log", snippet: "console.log(\"${1:label}:\", ${2:value});\n", description: "Log output" },
    { name: "+ For Loop", snippet: "for (let i = 0; i < ${1:array}.length; i++) {\n  ${2:// code}\n}\n", description: "Indexed loop" }
  ],
  typescript: [
    { name: "+ Interface", snippet: "interface ${1:ModelName} {\n  id: string;\n  ${2:name}: string;\n}\n", description: "Interface shape" },
    { name: "+ Type Union", snippet: "type ${1:Status} = \"${2:idle}\" | \"${3:active}\" | \"${4:done}\";\n", description: "Type union" },
    { name: "+ useState", snippet: "const [${1:state}, set${2:State}] = useState<${3:string}>(${4:\"\"});\n", description: "React state" },
    { name: "+ useEffect", snippet: "useEffect(() => {\n  ${1:// code}\n}, [${2}]);\n", description: "React effect" },
    { name: "+ Async Function", snippet: "async function ${1:fetchData}(): Promise<${2:void}> {\n  ${3:// code}\n}\n", description: "Typed async" }
  ],
  java: [
    { name: "+ Scanner Input", snippet: "Scanner sc = new Scanner(System.in);\nSystem.out.print(\"Enter value: \");\nif (sc.hasNextLine()) {\n    String val = sc.nextLine();\n    System.out.println(\"Input was: \" + val);\n}\n", description: "Scanner console input" },
    { name: "+ Class Template", snippet: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        ${1:System.out.println(\"Ready!\");}\n    }\n}\n", description: "Java Main class" },
    { name: "+ Main Method", snippet: "public static void main(String[] args) {\n    ${1:// code}\n}\n", description: "Main entry" },
    { name: "+ Println", snippet: "System.out.println(${1:\"Hello\"});\n", description: "Standard out" },
    { name: "+ For Loop", snippet: "for (int i = 0; i < ${1:10}; i++) {\n    ${2:// code}\n}\n", description: "For loop" },
    { name: "+ Try / Catch", snippet: "try {\n    ${1:// code}\n} catch (Exception e) {\n    e.printStackTrace();\n}\n", description: "Try catch" }
  ],
  cpp: [
    { name: "+ Main Boilerplate", snippet: "#include <iostream>\n\nint main() {\n    ${1:std::cout << \"Ready!\" << std::endl;}\n    return 0;\n}\n", description: "C++ main" },
    { name: "+ Std::cout", snippet: "std::cout << ${1:\"Hello\"} << std::endl;\n", description: "Cout print" },
    { name: "+ Vector Loop", snippet: "std::vector<${1:int}> ${2:items};\nfor (const auto& item : ${2:items}) {\n    ${3:// code}\n}\n", description: "Vector loop" }
  ],
  html: [
    { name: "+ HTML5 Shell", snippet: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <title>${1:Document}</title>\n</head>\n<body>\n  ${2:<h1>Hello</h1>}\n</body>\n</html>\n", description: "HTML5 document" },
    { name: "+ Flex Div", snippet: "<div class=\"flex items-center gap-3\">\n  ${1}\n</div>\n", description: "Flex container" },
    { name: "+ Button", snippet: "<button class=\"btn\">\n  ${1:Click Me}\n</button>\n", description: "Button element" }
  ],
  css: [
    { name: "+ Flex Center", snippet: "display: flex;\nalign-items: center;\njustify-content: center;\n", description: "Center flex" },
    { name: "+ Grid 3-Col", snippet: "display: grid;\ngrid-template-columns: repeat(3, 1fr);\ngap: 1rem;\n", description: "Grid 3 col" },
    { name: "+ Glass Style", snippet: "background: rgba(15, 23, 42, 0.8);\nbackdrop-filter: blur(12px);\nborder: 1px solid rgba(255, 255, 255, 0.1);\nborder-radius: 0.75rem;\n", description: "Glass frosted" }
  ]
};

// ─── 4. SEARCH & RESOLUTION ENGINE ───────────────────────────────────────────

export const AI_PRE_PROMPTS: CodeSuggestion[] = [
  {
    label: "prompt:crud_api",
    insertText: "// TODO: [AI Pre-Prompt] Implement production-ready REST API endpoints with request validation and error responses\n",
    detail: "✦ Pre-Prompt: CRUD API",
    kind: "ai",
    doc: "Insert pre-prompt to generate full CRUD endpoints with input validation"
  },
  {
    label: "prompt:error_handling",
    insertText: "// TODO: [AI Pre-Prompt] Add comprehensive error boundaries, try/catch handling, and contextual telemetry logging\n",
    detail: "✦ Pre-Prompt: Robust Error Handling",
    kind: "ai",
    doc: "Insert pre-prompt to add enterprise-grade try/catch and error recovery"
  },
  {
    label: "prompt:unit_tests",
    insertText: "// TODO: [AI Pre-Prompt] Generate complete unit test suite with mock fixtures and edge case verification\n",
    detail: "✦ Pre-Prompt: Unit Tests",
    kind: "ai",
    doc: "Insert pre-prompt to generate automated test cases for this code"
  },
  {
    label: "prompt:typescript_types",
    insertText: "// TODO: [AI Pre-Prompt] Define strict TypeScript interfaces, type guards, and generic return types\n",
    detail: "✦ Pre-Prompt: Type Definitions",
    kind: "ai",
    doc: "Insert pre-prompt to strongly type parameters, models, and return shapes"
  },
  {
    label: "prompt:optimize_performance",
    insertText: "// TODO: [AI Pre-Prompt] Profile and optimize algorithmic time complexity, memoize expensive calls, and reduce memory footprint\n",
    detail: "✦ Pre-Prompt: Optimize Performance",
    kind: "ai",
    doc: "Insert pre-prompt to refactor for minimal CPU and memory overhead"
  },
  {
    label: "prompt:documentation",
    insertText: "/**\n * @summary [AI Pre-Prompt] Professional JSDoc / Type specifications\n * @description Architectural specifications and parameter contracts\n */\n",
    detail: "✦ Pre-Prompt: JSDoc / Docstring",
    kind: "ai",
    doc: "Insert pre-prompt to document functions and data structures"
  }
];

export function getCodeSuggestions(
  prefix: string,
  language: string,
  documentContent: string
): CodeSuggestion[] {
  const normLang = (language || "javascript").toLowerCase();
  const cleanPrefix = prefix.trim().toLowerCase();

  // If empty or only whitespace, return top 5 common snippets
  const snippets = LANGUAGE_SNIPPETS[normLang] || LANGUAGE_SNIPPETS.javascript || [];
  const keywords = LANGUAGE_KEYWORDS[normLang] || LANGUAGE_KEYWORDS.javascript || [];

  if (!cleanPrefix) {
    return snippets.slice(0, 5);
  }

  const results: CodeSuggestion[] = [];

  // Check if user is typing a pre-prompt trigger (e.g. "pro", "pre", "ai", "todo", "test", "doc", "api", "opt")
  const isPrePromptTrigger = [
    "pro", "prompt", "pre", "ai", "todo", "test", "doc", "api", "opt", "ref", "fix"
  ].some(trigger => trigger.startsWith(cleanPrefix) || cleanPrefix.startsWith(trigger));

  if (isPrePromptTrigger) {
    for (const promptItem of AI_PRE_PROMPTS) {
      if (promptItem.label.toLowerCase().includes(cleanPrefix) || isPrePromptTrigger) {
        results.push(promptItem);
      }
    }
  }

  // 1. Check exact / prefix matches in snippets
  for (const snip of snippets) {
    const labelLower = snip.label.toLowerCase();
    if (labelLower === cleanPrefix) {
      results.unshift(snip); // Prioritize exact match
    } else if (labelLower.startsWith(cleanPrefix) || (cleanPrefix.length >= 2 && labelLower.includes(cleanPrefix))) {
      results.push(snip);
    }
  }

  // 2. Check language keywords
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (kwLower === cleanPrefix) {
      if (!results.some(r => r.label === kw)) {
        results.unshift({
          label: kw,
          insertText: kw + " ",
          detail: `keyword (${normLang})`,
          kind: "keyword",
          doc: `Language keyword "${kw}"`
        });
      }
    } else if (kwLower.startsWith(cleanPrefix)) {
      if (!results.some(r => r.label === kw)) {
        results.push({
          label: kw,
          insertText: kw + " ",
          detail: `keyword (${normLang})`,
          kind: "keyword",
          doc: `Language keyword "${kw}"`
        });
      }
    }
  }

  // 3. Half-typed fuzzy and shortcut mapping
  const shortcuts: Record<string, { label: string; snippet: string; detail: string }> = {
    fun: { label: "function", snippet: "function ${1:name}(${2:params}) {\n  ${3:// code}\n}\n", detail: "function declaration" },
    cla: { label: "class", snippet: "class ${1:ClassName} {\n  constructor(${2}) {\n    ${3}\n  }\n}\n", detail: "class declaration" },
    con: { label: "console.log", snippet: "console.log(${1:value});\n", detail: "standard output" },
    imp: { label: "import", snippet: "import { ${2:item} } from \"${1:module}\";\n", detail: "ES module import" },
    ret: { label: "return", snippet: "return ${1:value};\n", detail: "return statement" },
    asy: { label: "async function", snippet: "async function ${1:name}(${2:params}) {\n  ${3:await null;}\n}\n", detail: "async function" },
    fet: { label: "fetch", snippet: "fetch(\"${1:/api/endpoint}\")\n  .then(res => res.json())\n  .then(data => {\n    ${2:console.log(data);}\n  });\n", detail: "network fetch API" },
    int: { label: "interface", snippet: "interface ${1:Name} {\n  ${2:id}: ${3:string};\n}\n", detail: "TypeScript interface" },
    typ: { label: "type", snippet: "type ${1:Name} = ${2:string};\n", detail: "type alias" },
    use: { label: "useState", snippet: "const [${1:state}, set${2:State}] = useState(${3:null});\n", detail: "React hook" },
    eff: { label: "useEffect", snippet: "useEffect(() => {\n  ${1:// effect code}\n}, [${2}]);\n", detail: "React hook" }
  };

  for (const [key, item] of Object.entries(shortcuts)) {
    if (key.startsWith(cleanPrefix) || cleanPrefix.startsWith(key)) {
      if (!results.some(r => r.label === item.label)) {
        results.push({
          label: item.label,
          insertText: item.snippet,
          detail: item.detail,
          kind: "snippet",
          doc: `Quick completion for ${item.label}`
        });
      }
    }
  }

  // 4. Extract local identifiers from document content
  const idRegex = /[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g;
  const matches = documentContent.match(idRegex) || [];
  const seen = new Set<string>();

  for (const id of matches) {
    if (seen.has(id)) continue;
    seen.add(id);

    const idLower = id.toLowerCase();
    if (idLower !== cleanPrefix && idLower.startsWith(cleanPrefix)) {
      if (!results.some(r => r.label === id)) {
        results.push({
          label: id,
          insertText: id,
          detail: "identifier (in file)",
          kind: "variable",
          doc: `Identifier found in document: ${id}`
        });
      }
    }
  }

  // Limit to top 10 relevant suggestions
  return results.slice(0, 10);
}
