#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { listResources, readResource } from "./docs.js";

const server = new McpServer({
  name: "loop-docs",
  version: "0.1.0",
});

for (const doc of listResources()) {
  server.resource(
    doc.name,
    doc.uri,
    {
      description: doc.description,
      mimeType: doc.mimeType,
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: doc.mimeType,
          text: await readResource(doc.relativePath),
        },
      ],
    }),
  );
}

server.tool(
  "search_docs",
  "Search Loop documentation (SPEC, README, examples) for a keyword or phrase",
  {
    query: z.string().describe("Keyword or phrase to search for"),
  },
  async ({ query }) => {
    const q = query.toLowerCase();
    const matches: string[] = [];

    for (const doc of listResources()) {
      const text = await readResource(doc.relativePath);
      const lines = text.split("\n");
      const hits: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined && line.toLowerCase().includes(q)) {
          hits.push(i + 1);
        }
      }

      if (hits.length > 0) {
        const preview = hits
          .slice(0, 5)
          .map((line) => {
            const text = lines[line - 1]?.trim() ?? "";
            return `  L${line}: ${text}`;
          })
          .join("\n");
        const more = hits.length > 5 ? `\n  …and ${hits.length - 5} more` : "";
        matches.push(`## ${doc.name} (${doc.uri})\n${preview}${more}`);
      }
    }

    if (matches.length === 0) {
      return {
        content: [{ type: "text", text: `No matches for "${query}" in Loop docs.` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Found matches for "${query}":\n\n${matches.join("\n\n")}`,
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
