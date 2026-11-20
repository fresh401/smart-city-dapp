// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UrbanIssueRegistry {
    enum Status { Reported, Assigned, InProgress, Resolved, Closed }
    enum Priority { Low, Medium, High, Critical }

    struct Issue {
        uint256 id;
        string issueId;   
        string issueType;
        string location;
        string description;
        string reportDate;
        Priority priority;
        Status status;
        string assignedTo;
        address reporter;  
    }

    struct HistoryEntry {
        uint256 timestamp;
        Status status;
        string assignedTo;
        string comment;
        address actor;      
    }

    address public owner;
    mapping(address => bool) public staff;   // personnel municipal
    uint256 public issueCount;

    mapping(uint256 => Issue) private issues;
    mapping(uint256 => HistoryEntry[]) private history;
    mapping(string => bool) private usedIds; // empeche deux signalements avec le meme issueId

    event IssueCreated(uint256 indexed id, address indexed reporter, string issueId);
    event TeamAssigned(uint256 indexed id, string team, address indexed actor);
    event StatusUpdated(uint256 indexed id, Status oldStatus, Status newStatus, address indexed actor, string comment);

    constructor() {
        owner = msg.sender;
        staff[msg.sender] = true;
    }

    modifier onlyStaff() {
        require(staff[msg.sender], "Not staff");
        _;
    }

    function addStaff(address account) external {
        require(msg.sender == owner, "Not owner");
        staff[account] = true;
    }

    // Tout le monde peut declarer un probleme
    function createIssue(
        string memory _issueId,
        string memory _issueType,
        string memory _location,
        string memory _description,
        string memory _reportDate,
        Priority _priority
    ) external returns (uint256) {
        require(bytes(_issueId).length > 0 && bytes(_location).length > 0 && bytes(_description).length > 0, "Empty fields");
        require(!usedIds[_issueId], "Issue ID already used");
        usedIds[_issueId] = true;

        issueCount++;
        Issue storage i = issues[issueCount];
        i.id = issueCount;
        i.issueId = _issueId;
        i.issueType = _issueType;
        i.location = _location;
        i.description = _description;
        i.reportDate = _reportDate;
        i.priority = _priority;
        i.status = Status.Reported;
        i.reporter = msg.sender;

        _addHistory(issueCount, Status.Reported, "", "Issue reported");
        emit IssueCreated(issueCount, msg.sender, _issueId);
        return issueCount;
    }

    // Le personnel affecte une equipe : Reported -> Assigned
    function assignTeam(uint256 id, string memory team, string memory comment) external onlyStaff {
        Issue storage i = _get(id);
        require(bytes(team).length > 0, "Empty team");
        require(i.status < Status.Resolved, "Already resolved");

        i.assignedTo = team;
        if (i.status == Status.Reported) {
            i.status = Status.Assigned;
        }
        _addHistory(id, i.status, team, comment);
        emit TeamAssigned(id, team, msg.sender);
    }

    // Le personnel fait avancer le statut d'une seule etape
    function updateStatus(uint256 id, Status newStatus, string memory comment) external onlyStaff {
        Issue storage i = _get(id);
        require(i.status != Status.Reported, "Assign a team first");
        require(uint8(newStatus) == uint8(i.status) + 1, "Invalid status step");

        Status old = i.status;
        i.status = newStatus;
        _addHistory(id, newStatus, i.assignedTo, comment);
        emit StatusUpdated(id, old, newStatus, msg.sender, comment);
    }

    function getIssue(uint256 id) external view returns (Issue memory) {
        return _get(id);
    }

    function getHistory(uint256 id) external view returns (HistoryEntry[] memory) {
        _get(id);
        return history[id];
    }

    function _get(uint256 id) internal view returns (Issue storage) {
        require(id > 0 && id <= issueCount, "Unknown issue");
        return issues[id];
    }

    function _addHistory(uint256 id, Status s, string memory team, string memory comment) internal {
        history[id].push(HistoryEntry(block.timestamp, s, team, comment, msg.sender));
    }
}
