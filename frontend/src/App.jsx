import { useCallback, useEffect, useState } from "react";
import {
  useAccount, useConnect, useDisconnect, useChainId,
  useReadContract, useWriteContract, usePublicClient,
} from "wagmi";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { abi, contractAddress, STATUS, PRIORITY } from "./contract";

const EMPTY = { issueId: "", issueType: "StreetLight", location: "", description: "", reportDate: new Date().toISOString().slice(0, 10), priority: 1 };
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const when = (ts) => new Date(Number(ts) * 1000).toLocaleString("fr-FR");

const MESSAGES = {
  "Not staff": "Action réservée au personnel municipal : ce compte n’a pas ce rôle.",
  "Not owner": "Action réservée à l’administrateur du contrat.",
  "Issue ID already used": "Cette référence de signalement existe déjà.",
  "Empty fields": "Référence, localisation et description sont obligatoires.",
  "Empty team": "Indiquez le nom de l’équipe.",
  "Already resolved": "Ce signalement est déjà résolu : on ne peut plus changer l’équipe.",
  "Assign a team first": "Affectez d’abord une équipe avant de changer le statut.",
  "Invalid status step": "Changement de statut interdit : on avance d’une étape à la fois.",
  "Unknown issue": "Signalement introuvable.",
};
function errText(e) {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const reason = r instanceof ContractFunctionRevertedError ? r.reason : null;
    if (reason) return MESSAGES[reason] || `Refusé par le contrat : ${reason}`;
    if (e.shortMessage?.includes("User rejected")) return "Transaction refusée dans le wallet.";
    return e.shortMessage;
  }
  return e?.message || String(e);
}

export default function App() {
  const { address: account, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const contract = contractAddress(chainId);

  const { data: isStaff } = useReadContract({
    address: contract, abi, functionName: "staff", args: [account],
    query: { enabled: !!contract && !!account },
  });

  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null); // { issue, history }
  const [form, setForm] = useState(EMPTY);
  const [team, setTeam] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }
  const [busy, setBusy] = useState(false);

  const read = useCallback((functionName, args) => client.readContract({ address: contract, abi, functionName, args }), [client, contract]);

  const load = useCallback(async () => {
    if (!contract) return;
    const n = Number(await read("issueCount"));
    const list = await Promise.all(Array.from({ length: n }, (_, k) => read("getIssue", [BigInt(k + 1)])));
    setIssues(list.reverse());
  }, [contract, read]);

  useEffect(() => { load().catch((e) => setMsg({ type: "err", text: errText(e) })); }, [load]);

  async function open(id) {
    try {
      const [issue, history] = await Promise.all([read("getIssue", [id]), read("getHistory", [id])]);
      setSelected({ issue, history });
    } catch (e) { setMsg({ type: "err", text: errText(e) }); }
  }

  async function send(functionName, args, okText) {
    setBusy(true); setMsg(null);
    try {
      const hash = await writeContractAsync({ address: contract, abi, functionName, args });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction échouée");
      setMsg({ type: "ok", text: `${okText} Transaction : ${hash}` });
      await load();
      if (selected) await open(selected.issue.id);
      return true;
    } catch (e) {
      setMsg({ type: "err", text: errText(e) });
    } finally { setBusy(false); }
  }

  const suggested = `CITY-2026-${String(issues.length + 1).padStart(3, "0")}`;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    const ok = await send("createIssue", [form.issueId || suggested, form.issueType, form.location, form.description, form.reportDate, Number(form.priority)], "Signalement enregistré.");
    if (ok) setForm({ ...EMPTY, issueId: "" });
  }

  const issue = selected?.issue;
  const nextStatus = issue && issue.status >= 1 && issue.status < 4 ? issue.status + 1 : null;

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <h1>Smart City · Signalements urbains</h1>
          {isConnected
            ? <p className="small">{short(account)} · {isStaff ? "personnel municipal" : "citoyen"} <button onClick={() => disconnect()}>Déconnecter</button></p>
            : connectors.map((c) => <button key={c.uid} className="primary" onClick={() => connect({ connector: c })}>Connecter {c.name}</button>)}
        </div>
      </header>

      <main className="wrap stack">
        {!contract && <p className="msg err">Aucun contrat déployé sur ce réseau. Lancez <span className="mono">npm run deploy:local</span> puis rechargez.</p>}
        {msg && <p className={`msg ${msg.type}`} role="alert" style={{ wordBreak: "break-all" }}>{msg.text}</p>}

        <section className="panel">
          <h3>Déclarer un problème</h3>
          <form className="grid" onSubmit={create}>
            <label>Référence<input value={form.issueId} onChange={set("issueId")} placeholder={suggested} /></label>
            <label>Type
              <select value={form.issueType} onChange={set("issueType")}>
                {["StreetLight", "Pothole", "Waste", "Water", "Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Localisation<input value={form.location} onChange={set("location")} required /></label>
            <label>Priorité
              <select value={form.priority} onChange={set("priority")}>
                {PRIORITY.map((p, i) => <option key={p} value={i}>{p}</option>)}
              </select>
            </label>
            <label className="full">Description<input value={form.description} onChange={set("description")} maxLength={280} required /></label>
            <div className="full"><button className="primary" disabled={!isConnected || !contract || busy}>{busy ? "En cours…" : "Enregistrer sur la blockchain"}</button></div>
          </form>
          <p className="muted small">Aucune donnée personnelle : le déclarant est identifié uniquement par son adresse wallet.</p>
        </section>

        <section className="panel">
          <h3>Signalements ({issues.length})</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>N°</th><th>Référence</th><th>Type</th><th>Lieu</th><th>Priorité</th><th>Statut</th><th>Équipe</th><th></th></tr></thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id.toString()}>
                    <td>{i.id.toString()}</td><td>{i.issueId}</td><td>{i.issueType}</td><td>{i.location}</td>
                    <td>{PRIORITY[i.priority]}</td><td><b>{STATUS[i.status]}</b></td><td>{i.assignedTo || "—"}</td>
                    <td><button onClick={() => open(i.id)}>Détails</button></td>
                  </tr>
                ))}
                {issues.length === 0 && <tr><td colSpan={8} className="muted">Aucun signalement.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {issue && (
          <section className="panel">
            <h3>{issue.issueId} · {STATUS[issue.status]}</h3>
            <p className="muted">{issue.description} — {issue.location} ({issue.reportDate}) · déclaré par <span className="mono">{short(issue.reporter)}</span></p>

            <h3 style={{ fontSize: "1.05rem" }}>Historique</h3>
            <ul className="log">
              {selected.history.map((h, k) => (
                <li key={k} className="ok">
                  <b>{STATUS[h.status]}</b> · {when(h.timestamp)}{h.assignedTo && <> · équipe {h.assignedTo}</>}
                  {h.comment && <> · « {h.comment} »</>} · par <span className="mono">{short(h.actor)}</span>
                </li>
              ))}
            </ul>

            {isStaff && issue.status < 3 && (
              <div className="row">
                <label className="grow">Équipe<input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="UrbanTeam01" /></label>
                <label className="grow">Commentaire<input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
                <button disabled={busy || !team} onClick={() => send("assignTeam", [issue.id, team, comment], "Équipe affectée.")}>Affecter</button>
                {nextStatus && <button className="primary" disabled={busy} onClick={() => send("updateStatus", [issue.id, nextStatus, comment], "Statut mis à jour.")}>Passer à {STATUS[nextStatus]}</button>}
              </div>
            )}
            {isStaff && issue.status === 3 && (
              <div className="row">
                <label className="grow">Commentaire<input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
                <button className="primary" disabled={busy} onClick={() => send("updateStatus", [issue.id, 4, comment], "Signalement clôturé.")}>Clôturer</button>
              </div>
            )}
            {!isStaff && isConnected && <p className="muted small">Seul le personnel municipal peut affecter une équipe ou changer le statut.</p>}
          </section>
        )}
      </main>
    </>
  );
}
