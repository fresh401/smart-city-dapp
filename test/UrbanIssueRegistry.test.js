const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Status : Reported=0, Assigned=1, InProgress=2, Resolved=3, Closed=4
async function deploy() {
  const [owner, staff, citizen] = await ethers.getSigners();
  const reg = await ethers.deployContract("UrbanIssueRegistry");
  await reg.addStaff(staff.address);
  return { reg, owner, staff, citizen };
}

// createIssue(issueId, type, location, description, date, priority)
const create = (reg, who, id = "CITY-2026-001") =>
  reg.connect(who).createIssue(id, "StreetLight", "Avenue Mohammed V", "Streetlight not working", "2026-11-19", 2);

describe("UrbanIssueRegistry", () => {
  it("un citoyen cree un signalement", async () => {
    const { reg, citizen } = await loadFixture(deploy);
    await expect(create(reg, citizen))
      .to.emit(reg, "IssueCreated").withArgs(1n, citizen.address, "CITY-2026-001");

    const issue = await reg.getIssue(1);
    expect(issue.issueId).to.equal("CITY-2026-001");
    expect(issue.status).to.equal(0n);
    expect(issue.reporter).to.equal(citizen.address);
    expect((await reg.getHistory(1)).length).to.equal(1);
  });

  it("refuse un issueId deja utilise et les champs vides", async () => {
    const { reg, citizen } = await loadFixture(deploy);
    await create(reg, citizen);
    await expect(create(reg, citizen)).to.be.revertedWith("Issue ID already used");
    await expect(reg.connect(citizen).createIssue("CITY-2026-002", "Pothole", "", "desc", "2026-11-19", 1))
      .to.be.revertedWith("Empty fields");
  });

  it("echoue pour un id inconnu", async () => {
    const { reg } = await loadFixture(deploy);
    await expect(reg.getIssue(99)).to.be.revertedWith("Unknown issue");
  });

  it("seul le personnel peut affecter une equipe", async () => {
    const { reg, staff, citizen } = await loadFixture(deploy);
    await create(reg, citizen);
    await expect(reg.connect(citizen).assignTeam(1, "UrbanTeam01", "")).to.be.revertedWith("Not staff");

    await expect(reg.connect(staff).assignTeam(1, "UrbanTeam01", "Team dispatched"))
      .to.emit(reg, "TeamAssigned").withArgs(1n, "UrbanTeam01", staff.address);
    const issue = await reg.getIssue(1);
    expect(issue.status).to.equal(1n);
    expect(issue.assignedTo).to.equal("UrbanTeam01");
  });

  it("cycle de vie complet avec historique", async () => {
    const { reg, staff, citizen } = await loadFixture(deploy);
    await create(reg, citizen);
    await reg.connect(staff).assignTeam(1, "UrbanTeam01", "Assigned");
    await reg.connect(staff).updateStatus(1, 2, "Work started");
    await reg.connect(staff).updateStatus(1, 3, "Lamp replaced");
    await reg.connect(staff).updateStatus(1, 4, "Closed");

    const h = await reg.getHistory(1);
    expect(h.map((e) => e.status)).to.deep.equal([0n, 1n, 2n, 3n, 4n]);
    expect(h[3].comment).to.equal("Lamp replaced");
    expect(h[0].actor).to.equal(citizen.address);
    expect(h[4].actor).to.equal(staff.address);
  });

  it("interdit les sauts de statut et le statut sans equipe", async () => {
    const { reg, staff, citizen } = await loadFixture(deploy);
    await create(reg, citizen);
    await expect(reg.connect(staff).updateStatus(1, 1, "")).to.be.revertedWith("Assign a team first");

    await reg.connect(staff).assignTeam(1, "UrbanTeam01", "");
    await expect(reg.connect(staff).updateStatus(1, 3, "")).to.be.revertedWith("Invalid status step");
    await expect(reg.connect(citizen).updateStatus(1, 2, "")).to.be.revertedWith("Not staff");
  });

  it("seul l'owner ajoute du personnel", async () => {
    const { reg, citizen } = await loadFixture(deploy);
    await expect(reg.connect(citizen).addStaff(citizen.address)).to.be.revertedWith("Not owner");
  });
});
