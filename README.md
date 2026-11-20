# Smart City · Plateforme décentralisée de signalements urbains (avancement n°1)

Smart contract `UrbanIssueRegistry` (Hardhat) + frontend React/Vite (wagmi/viem).

## État d'avancement
- [x] Smart contract : création, consultation, affectation d'équipe, statuts, historique, événements
- [x] Tests Hardhat (7 tests)
- [x] Déploiement local avec 2 signalements fictifs
- [x] Frontend : connexion wallet, formulaire, liste, détail + historique, actions municipales
- [x] Fichier Excel de test `sample/urban_issues.xlsx`
- [ ] Import Excel côté interface (SheetJS) : aperçu, validation, sélection, envoi par lots
- [ ] Déploiement Sepolia, captures d'écran, vidéo de démo

## Lancer
```bash
npm install && npx hardhat test
npx hardhat node                  # terminal 1 (laisser ouvert)
npm run deploy:local              # terminal 2
cd frontend && npm install && npm run dev    # http://localhost:5173
```
Compte #0 de Hardhat = owner et personnel municipal. Pour tester le rôle « citoyen », connecter un autre compte de test.

## Choix de conception
- **Cycle de vie** : Reported → Assigned → InProgress → Resolved → Closed. Une seule étape à la fois ; `Assigned` s'obtient uniquement via `assignTeam`.
- **Traçabilité** : chaque action ajoute une entrée d'historique (date, statut, équipe, commentaire, adresse de l'acteur) et émet un événement.
- **Rôles** : tout le monde peut déclarer ; seul le personnel (ajouté par l'owner avec `addStaff`) affecte une équipe ou met à jour le statut.
- **Pas de données personnelles on-chain** : le déclarant est une adresse wallet (la colonne `reportedBy` de l'Excel n'est pas stockée).
- **Identifiants** : `id` numérique unique + référence métier `issueId` (CITY-2026-001) unique.
