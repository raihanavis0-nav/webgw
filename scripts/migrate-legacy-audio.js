/* Idempotent legacy audio migration to thoughts-data. Run with:
 * THOUGHTS_GITHUB_TOKEN=... THOUGHTS_LEGACY_GITHUB_TOKEN=... node scripts/migrate-legacy-audio.js
 * Never writes or deletes data in the legacy repository.
 */
"use strict";
const OWNER = "raihanavis0-nav";
const DEST = process.env.THOUGHTS_STORAGE_REPO || "webgw";
const BRANCH = process.env.THOUGHTS_STORAGE_BRANCH || "thoughts-data";
const SOURCE = "alfathxxxxyz/websiteguaa";
const sourceToken = process.env.THOUGHTS_LEGACY_GITHUB_TOKEN || process.env.THOUGHTS_GITHUB_TOKEN;
const destToken = process.env.THOUGHTS_GITHUB_TOKEN;
if (!destToken || !sourceToken) {
  console.error("Configure THOUGHTS_GITHUB_TOKEN and THOUGHTS_LEGACY_GITHUB_TOKEN before migration.");
  process.exit(1);
}
async function call(repo,path,token,options={}) {
  const response = await fetch("https://api.github.com/repos/" + repo + path, {
    ...options,
    headers: { Authorization:"Bearer " + token,
      Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json", ...(options.headers||{}) }
  });
  if (!response.ok) throw new Error(path + " failed: " + response.status + " " + (await response.text()).slice(0,200));
  return response.json();
}
async function main() {
  const destination = OWNER + "/" + DEST;
  const [from,to,ref] = await Promise.all([
    call(SOURCE,"/git/trees/" + BRANCH + "?recursive=1",sourceToken),
    call(destination,"/git/trees/" + BRANCH + "?recursive=1",destToken),
    call(destination,"/git/ref/heads/" + BRANCH,destToken),
  ]);
  if (from.truncated || to.truncated) throw new Error("GitHub tree results truncated; aborting.");
  const exists = new Set(to.tree.map(item => item.path));
  const missing = from.tree.filter(item =>
    item.type === "blob" &&
    item.path.startsWith("assets/thoughts/audio/chunks/") &&
    item.path.endsWith(".part") && !exists.has(item.path)
  );
  if (!missing.length) { console.log("All legacy chunks already migrated."); return; }
  const entries = [];
  for (const file of missing) {
    const blob = await call(SOURCE,"/git/blobs/" + file.sha,sourceToken);
    if (blob.encoding !== "base64" || !blob.content) throw new Error("Unexpected blob encoding: " + file.path);
    const uploaded = await call(destination,"/git/blobs",destToken,{
      method:"POST",body:JSON.stringify({content:blob.content.split(String.fromCharCode(10)).join("").split(String.fromCharCode(13)).join(""),encoding:"base64"})
    });
    if (uploaded.sha !== file.sha) throw new Error("Blob hash mismatch: " + file.path);
    entries.push({path:file.path,mode:"100644",type:"blob",sha:uploaded.sha});
    console.log("Copied " + entries.length + "/" + missing.length + " audio chunks");
  }
  const tree = await call(destination,"/git/trees",destToken,{
    method:"POST",body:JSON.stringify({base_tree:to.sha,tree:entries})
  });
  const commit = await call(destination,"/git/commits",destToken,{
    method:"POST",body:JSON.stringify({
      message:"chore: migrate legacy audio chunks to primary archive storage",
      tree:tree.sha,parents:[ref.object.sha]
    })
  });
  await call(destination,"/git/refs/heads/" + BRANCH,destToken,{
    method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})
  });
  console.log("Migration completed: " + missing.length + " chunks. Commit: " + commit.sha);
}
main().catch(error => {console.error(error.message);process.exitCode=1;});
