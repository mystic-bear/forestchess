"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function main() {
  const indexHtml = read("index.html");
  const constants = read("shared/constants.js");
  const game = read("js/game.js");
  const ui = read("js/ui.js");

  assert.match(indexHtml, /Forest Chess/, "start screen title should be Forest Chess");
  assert.match(indexHtml, /White \/ Black 설정/, "setup should reference White / Black");
  assert.match(indexHtml, /js\/chess\/chess-state\.js/, "HTML should load the chess core");
  assert.doesNotMatch(indexHtml, /루미큐브|새 줄|줄에 추가|조커|30룰/, "main HTML should not expose Rummikub copy");

  assert.match(constants, /AI-7/, "setup states should include AI-7");
  assert.doesNotMatch(constants, /"OFF"/, "setup states should no longer include OFF");

  assert.match(game, /selectedSquare/, "game state should track a selected square");
  assert.match(game, /pendingPromotion/, "game state should track promotion UI state");
  assert.match(game, /handleSquareClick/, "game should expose board click handling");
  assert.doesNotMatch(game, /createGroupFromSelection|appendSelectionToSelectedGroup|drawTile|workingTable/, "Rummikub turn actions should be removed");

  assert.match(ui, /board-grid/, "UI should render the chess board");
  assert.match(ui, /promotion-modal/, "UI should render the promotion modal");
  assert.match(ui, /move-list/, "UI should render the move list");

  console.log("PASS phase2-static-smoke");
}

main();
