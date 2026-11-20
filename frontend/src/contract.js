import { parseAbi } from "viem";
import deployments from "./deployments.json";

export const STATUS = ["Reported", "Assigned", "InProgress", "Resolved", "Closed"];
export const PRIORITY = ["Low", "Medium", "High", "Critical"];

const ISSUE = "(uint256 id, string issueId, string issueType, string location, string description, string reportDate, uint8 priority, uint8 status, string assignedTo, address reporter)";
const HISTORY = "(uint256 timestamp, uint8 status, string assignedTo, string comment, address actor)";

export const abi = parseAbi([
  "function issueCount() view returns (uint256)",
  "function staff(address) view returns (bool)",
  `function getIssue(uint256 id) view returns (${ISSUE})`,
  `function getHistory(uint256 id) view returns (${HISTORY}[])`,
  "function createIssue(string issueId, string issueType, string location, string description, string reportDate, uint8 priority) returns (uint256)",
  "function assignTeam(uint256 id, string team, string comment)",
  "function updateStatus(uint256 id, uint8 newStatus, string comment)",
]);

export const contractAddress = (chainId) =>
  deployments[String(chainId)] || import.meta.env.VITE_CONTRACT_ADDRESS || undefined;
