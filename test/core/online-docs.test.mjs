// The online documents a tool call wrote (online-docs.ts): which calls are writes, which addresses are documents, and
// the name a write gave one. The command lines and results are shaped as lark-cli, gws and MCP tools answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mayWriteOnlineDoc, onlineDocOf, onlineDocShort, onlineDocWrites, writesByCommand, writesByTool } from "../../dist/core/online-docs.js";

const LARK_DOC = "https://acme.sg.larksuite.com/docx/Vf6UdiUTvoIESpxu04hlTT20gzd";
const bash = (command) => ({ command });

test("an online document's address: its kind, and the address it is listed under", () => {
  assert.deepEqual(onlineDocOf(`${LARK_DOC}?from=from_copylink#part-1`), { url: LARK_DOC, word: "飞书文档" }, "no query, no anchor");
  assert.equal(onlineDocOf("https://x.feishu.cn/sheets/LPZdsc7NThNQ4Qthuu2lsjTXgLd").word, "飞书表格");
  assert.equal(onlineDocOf("https://x.larksuite.com/base/SRhDbYJpNas1iYs2AGDlNL6xgMK").word, "多维表格");
  assert.equal(onlineDocOf("https://x.larksuite.com/wiki/VHPuwPMM0iDJoikC20Rl7p2JgVb").word, "飞书文档");
  assert.deepEqual(onlineDocOf("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUv/edit?gid=0#gid=0"), { url: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUv/edit", word: "Google 表格" }, "a Google document at its edit page");
  assert.equal(onlineDocOf("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUv/view").word, "Google 文档");
  assert.equal(onlineDocOf("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUv").word, "Google 幻灯片");
  assert.equal(onlineDocOf("https://www.notion.so/acme/Plan-0123456789abcdef0123456789abcdef").word, "Notion 页面");
  assert.equal(onlineDocOf("https://acme.atlassian.net/wiki/spaces/ENG/pages/123456/Plan").word, "Confluence 页面");
  assert.equal(onlineDocOf("https://docs.qq.com/sheet/DUkNFdWxXbm1y").word, "腾讯文档");
  assert.equal(onlineDocOf("https://www.yuque.com/acme/kb/plan").word, "语雀文档");
  assert.equal(onlineDocOf("https://alidocs.dingtalk.com/i/nodes/abc").word, "钉钉文档");
  assert.equal(onlineDocOf("https://www.kdocs.cn/l/abc").word, "金山文档");
  const office = onlineDocOf("https://acme.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc=%7B1%7D");
  assert.deepEqual(office, { url: "https://acme.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc=%7B1%7D", word: "Office 文档" }, "Office's address keeps its query: it names the document");
  for (const not of ["https://acme.sg.larksuite.com/docx/SHtwdzcSYo5xp", "https://acme.sg.larksuite.com/docx/SHtwdzcSYo5xpKxOgArl…", "https://open.larksuite.com/page/scope-apply?clientID=x", "https://docs.google.com/", "https://accounts.google.com/o/oauth2", "https://github.com/a/b", "https://claude.ai/artifact/X", "not an address"]) assert.equal(onlineDocOf(not), undefined, not);
  assert.equal(onlineDocShort(LARK_DOC), "Vf6U…0gzd");
  assert.equal(onlineDocShort("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUv/edit"), "1AbC…StUv", "the id, not edit");
});

test("which command lines write: a document tool's words before its first flag say a write; help, dry runs, reads and messages do not", () => {
  for (const c of [
    "lark-cli docs +update --doc X --command append --content y",
    "export A=1 && lark-cli docs +create --title \"计划\" --as user",
    "rtk lark-cli drive +import --file a.xlsx --type bitable",
    "lark-cli sheets +workbook-import --file a.xlsx --name \"清单\"",
    "U=\"https://x\"; lark-cli sheets +batch --url \"$U\" --ops '[]'",
    "lark-cli base +record-batch-update --base-token T",
    "gws docs documents create --json '{\"title\": \"Plan\"}'",
    "gws sheets spreadsheets values update --params '{}'",
    "gog docs create \"Plan\"",
  ]) assert.equal(writesByCommand(c), true, c);
  for (const c of [
    "lark-cli docs +fetch --doc X",
    "lark-cli docs +update --help 2>&1 | head",
    "lark-cli sheets +cells-get --url U",
    "lark-cli sheets +batch --url U --dry-run",
    "lark-cli drive +list-comments --file-token T",
    "lark-cli drive +add-comment --file-token T --content hi",
    "lark-cli im +messages-send --chat-id C --text https://x.larksuite.com/docx/AbC",
    "lark-cli auth login --scope docs",
    "gws drive files list",
    "git commit -m 'lark-cli docs +update, documented'",
    "npm run build",
  ]) assert.equal(writesByCommand(c), false, c);
});

test("which MCP tools write: their own name says a write, and is no read, no message and none of gemworks's", () => {
  for (const t of ["mcp__lark-mcp__docx_builtin_import", "mcp__lark-mcp__bitable_v1_appTableRecord_update", "mcp__notion__notion-create-pages", "mcp__atlassian__updateConfluencePage", "mcp__google__create_spreadsheet", "mcp__gdocs__modify_doc_text"]) assert.equal(writesByTool(t), true, t);
  for (const t of ["mcp__lark-mcp__docx_v1_document_rawContent", "mcp__lark-mcp__bitable_v1_appTableRecord_search", "mcp__lark-mcp__im_v1_message_create", "mcp__lark-mcp__drive_v1_permissionMember_create", "mcp__gemworks__artifact", "Read", "Write"]) assert.equal(writesByTool(t), false, t);
  assert.equal(mayWriteOnlineDoc("Bash", bash("lark-cli docs +create --title x")), true);
  assert.equal(mayWriteOnlineDoc("PowerShell", bash("lark-cli docs +create --title x")), true);
  assert.equal(mayWriteOnlineDoc("Bash", bash("ls")), false);
  assert.equal(mayWriteOnlineDoc("Write", { file_path: "a.md", content: "lark-cli docs +create" }), false, "a file that mentions a command is no command");
});

test("what a write wrote: the documents its result names, else those it was given; none when it failed or only showed the request", () => {
  const created = '{ "ok": true, "data": { "document": { "document_id": "Vf6U", "url": "https://acme.sg.larksuite.com/docx/Vf6UdiUTvoIESpxu04hlTT20gzd", "title": "迁移方案" } } }';
  assert.deepEqual(onlineDocWrites("Bash", bash('lark-cli docs +create --title "迁移方案" --content x'), created), [{ url: LARK_DOC, word: "飞书文档", name: "迁移方案" }]);
  const updated = '{ "ok": true, "data": { "document": { "revision_id": 41, "url": "https://acme.sg.larksuite.com/docx/Vf6UdiUTvoIESpxu04hlTT20gzd" } }, "_notice": { "update": { "message": "lark-cli 1.0.93 available" } } }';
  assert.deepEqual(onlineDocWrites("Bash", bash("lark-cli docs +update --doc Vf6U --command append --content x"), updated), [{ url: LARK_DOC, word: "飞书文档" }], "no name given: none");
  const sheet = "https://acme.sg.larksuite.com/sheets/LPZdsc7NThNQ4Qthuu2lsjTXgLd";
  assert.deepEqual(onlineDocWrites("Bash", bash(`U="${sheet}"; lark-cli sheets +batch --url "$U" --ops '[]'`), '{ "ok": true, "data": { "results": [] } }'), [{ url: sheet, word: "飞书表格" }], "a result without an address: the one it was given");
  assert.deepEqual(onlineDocWrites("Bash", bash(`lark-cli sheets +batch --url "${sheet}" --ops '[]'`), '{ "ok": true, "dry_run": true, "data": {} }'), [], "a dry run wrote nothing");
  assert.deepEqual(onlineDocWrites("Bash", bash("lark-cli whiteboard +update --whiteboard-token T"), '{ "ok": false, "error": { "type": "missing_scope", "hint": "https://open.larksuite.com/page/scope-apply" } }'), [], "a failure wrote nothing");
  assert.deepEqual(onlineDocWrites("Bash", bash("lark-cli docs +fetch --doc X"), created), [], "a read wrote nothing, whatever it names");
  const google = '{ "documentId": "1AbCdEfGhIjKlMnOpQrStUvWxYz0123", "title": "Plan", "revisionId": "r1" }';
  assert.deepEqual(onlineDocWrites("Bash", bash("gws docs documents create --json '{\"title\": \"Plan\"}'"), google), [{ url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123/edit", word: "Google 文档", name: "Plan" }], "Google's API names it by id alone");
  const notion = "https://www.notion.so/acme/Plan-0123456789abcdef0123456789abcdef";
  assert.deepEqual(onlineDocWrites("mcp__notion__notion-create-pages", { pages: [{ properties: { title: "Plan" } }] }, `Created page ${notion}`), [{ url: notion, word: "Notion 页面", name: "Plan" }]);
  const many = Array.from({ length: 6 }, (_, i) => `https://acme.larksuite.com/docx/Doc${i}abcdefghijklmnopqrstuv`).join("\n");
  assert.deepEqual(onlineDocWrites("Bash", bash("lark-cli docs +update --doc X"), many), [], "a list of documents is one that read");
  const two = `${LARK_DOC}\nhttps://acme.sg.larksuite.com/docx/Other1234567890abcdefghijk`;
  assert.deepEqual(onlineDocWrites("Bash", bash('lark-cli docs +update --title "x" --doc X'), two).map((d) => d.name), [undefined, undefined], "a name for one document alone");
});
