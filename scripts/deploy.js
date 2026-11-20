const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const registry = await ethers.deployContract("UrbanIssueRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`UrbanIssueRegistry déployé sur ${network.name} (chainId ${chainId}) : ${address}`);

  // Données fictives de démonstration (réseau local uniquement)
  if (chainId === 31337n) {
    const demo = [
      { issueId: "CITY-2026-001", issueType: "StreetLight", location: "Avenue Mohammed V", description: "Streetlight not working", reportDate: "2026-11-19", priority: 2 },
      { issueId: "CITY-2026-002", issueType: "Pothole", location: "Rue de la Liberté", description: "Large pothole near the crossing", reportDate: "2026-11-19", priority: 3 },
    ];
    for (const d of demo) await (await registry.createIssue(d.issueId, d.issueType, d.location, d.description, d.reportDate, d.priority)).wait();
    await (await registry.assignTeam(1, "UrbanTeam01", "Team dispatched")).wait();
    console.log("2 signalements fictifs créés (le n°1 est affecté à UrbanTeam01).");
  }

  const file = path.join(__dirname, "..", "frontend", "src", "deployments.json");
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  current[String(chainId)] = address;
  fs.writeFileSync(file, JSON.stringify(current, null, 2));
  console.log("frontend/src/deployments.json mis à jour.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
