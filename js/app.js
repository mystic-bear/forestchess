let aiBridge;

try {
  aiBridge = new AIBridge();
} catch (error) {
  console.error("AI bridge bootstrap failed:", error);
  aiBridge = createUnavailableAIBridge(error);
}

window.aiBridge = aiBridge;
window.ui = ui;

const game = new Game({ aiBridge, ui });
window.game = game;

ui.renderStart();
ui.renderSetup();
ui.showScreen("start-screen");
ui.updateAll();

window.addEventListener("resize", () => {
  ui.updateAll();
});
