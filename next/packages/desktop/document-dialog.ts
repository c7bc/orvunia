export function nativeDocumentDialog() {
  return {
    properties: ["openFile", "multiSelections"] as const,
    filters: [
      {
        name: "Contexto",
        extensions: [
          "pdf",
          "docx",
          "txt",
          "md",
          "json",
          "csv",
          "ts",
          "js",
          "py",
          "java",
          "cpp",
          "go",
          "rs",
          "sql",
          "kt",
          "cs",
          "rb",
        ],
      },
    ],
  };
}
