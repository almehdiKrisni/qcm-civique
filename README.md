# QCM Civique

Application d'entraînement au QCM de l'examen civique pour la naturalisation française. Elle fonctionne dans le navigateur, s'installe sur l'écran d'accueil d'un téléphone et marche hors ligne une fois chargée.

> Application non officielle. Les réponses et explications sont préparées avec l'aide d'une IA : en cas de doute, la référence est le Livret du citoyen du ministère de l'Intérieur.

## Les questions

L'application reprend les 258 questions de la liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur, janvier 2026), réparties en 7 catégories. Cette liste ne contient que les énoncés : les quatre choix et les explications sont préparés avec l'aide d'une IA, puis relus avec le Livret du citoyen. Les fausses réponses sont écrites pour être plausibles et de longueur comparable à la bonne réponse (un test le vérifie).

## Fonctions

- **Simulation d'examen** : 40 questions, chronomètre de 45 minutes, tirage équilibré entre catégories, seuil de réussite de 80 % (32/40). Comme à l'examen, on peut passer une question sans répondre (un message d'attention s'affiche) : elle est comptée fausse. Le temps écoulé met fin à l'épreuve.
- **Séries d'entraînement** de 10, 20 ou 30 questions par catégorie ou toutes catégories, avec ou sans correction immédiate.
- **Série intelligente** : tirage qui favorise vos erreurs, les questions jamais vues et celles que vous avez marquées.
- **Questions à revoir** : marquez une question avec ☆ et retrouvez-la dans une liste, avec une série dédiée.
- **Fiches de révision** : l'essentiel de chaque question par catégorie, avec recherche.
- « En savoir plus » sous chaque question : l'essentiel à retenir, le contexte et la page du Livret du citoyen (édition de mai 2026) quand le sujet y figure.
- Thème bleu-blanc-rouge, mode clair ou sombre, texte agrandissable.
- Suivi de la maîtrise par catégorie : une question est maîtrisée quand la dernière réponse était juste.
- Résultat détaillé : toutes les questions posées, votre réponse, la bonne réponse et la justification.
- Reprise des erreurs d'une série en tentatives successives, avec le détail de chaque tentative dans l'historique.
- Aucune donnée envoyée : l'historique reste dans le navigateur. Export et import pour le sauvegarder ou le transférer.

## Installer sur iPhone

1. Ouvrir l'adresse du site dans **Safari**.
2. Toucher Partager, puis « Sur l'écran d'accueil ».
3. Lancer l'application depuis son icône. Elle fonctionne sans connexion après le premier chargement.

Installer l'application sur l'écran d'accueil protège aussi l'historique : dans un simple onglet Safari, iOS peut effacer les données d'un site peu utilisé. Pensez à exporter l'historique de temps en temps.

## Accessibilité

L'accessibilité a été auditée puis corrigée, avec des mesures avant et après (`tools/a11y-audit.js` dans un navigateur, `tests/a11y.test.js` en test automatique). Référence : WCAG 2.2, niveau AA.

| Mesure | Avant | Après |
|---|---|---|
| Contraste du texte, thème clair | 0 échec | 0 échec |
| Contraste du texte, thème sombre (minimum 4,5:1) | 273 échecs sur 2 208 textes mesurés | 0 échec (4 424 textes mesurés, deux thèmes) |
| Zones de toucher inférieures à 44 px | 15 | 0 |
| Sauts de niveau de titre | 6 | 0 |
| Réponses | boutons simples | vrais boutons radio dans un groupe (clavier et lecteur d'écran) |
| Correction | couleur seule | repère ✓ / ✗, texte pour lecteur d'écran, zone annoncée |
| Boîtes de dialogue | sans nom, focus resté derrière | rôle, description, focus piégé, fond inactif, focus rendu à la fermeture |
| Changement d'écran | focus perdu | focus sur le titre, titre de page mis à jour |
| Indicateur de focus, mouvement réduit | absents | présents |
| Chronomètre | non annoncé | annonces à 5 min, 1 min et 10 s (pas chaque seconde) |

Aussi vérifié : pas de défilement horizontal à 320 px avec le texte agrandi, zoom autorisé, langue déclarée, aucun nom manquant sur les contrôles. Limite : ces contrôles automatiques ne remplacent ni un essai avec un lecteur d'écran réel ni l'avis de personnes concernées ; l'application n'a pas fait l'objet d'un audit externe.

## Comment ce projet a été construit

Ce projet a été réalisé avec l'aide d'une IA (Claude), par une personne qui n'est pas développeuse de métier, pour répondre à un besoin du quotidien : préparer l'examen civique. L'objectif est aussi de montrer qu'avec de la méthode (sources vérifiées, sécurité, vie privée, accessibilité, tests), une personne non experte peut construire un outil fiable pour un besoin de ce type.

**Décisions prises par l'utilisateur** : se concentrer sur les seules questions du document officiel ; fournir le Livret du citoyen pour vérifier les réponses ; calquer la simulation sur l'examen réel (45 minutes, passer une question sans répondre la compte fausse) ; demander si l'application présentait un risque de sécurité et activer la double authentification du compte ; remarquer que la bonne réponse était presque toujours la plus longue.

**Rôle de l'IA** : écrire le code, proposer des explications, des tests et des mesures, puis corriger ce que l'utilisateur ou les contrôles ont signalé.

**Erreurs de l'IA détectées et corrigées** :
- congé de paternité indiqué à 25 jours au lieu de 28, et 22 réponses corrigées au total après relecture avec le Livret ;
- 15 questions manquantes, car des lignes du PDF officiel étaient des images (trouvées par reconnaissance optique) ;
- bonne réponse la plus longue dans 69 % des questions, ramenée à 28 % ; un test le vérifie désormais ;
- un test qui réussissait sans rien prouver (touche envoyée au mauvais élément), refait ;
- boîtes natives bloquées par le navigateur (« Abandonner » ne faisait rien), remplacées par des boîtes intégrées ;
- contraste insuffisant du thème sombre, détecté par l'audit.

**Bonnes pratiques appliquées et vérifiées** : politique de sécurité (CSP) testée, aucune ressource externe ni secret, actions GitHub épinglées avec droits en lecture seule, aucune donnée personnelle envoyée ou publiée, tests automatiques à chaque publication, mention claire « non officiel » et renvoi au Livret.

**Limites** : outil local sans donnée sensible. Pour des paiements, des données de santé ou celles d'autres personnes, l'avis d'un expert reste nécessaire. Les réponses restent préparées avec une IA : en cas de doute, la référence est le Livret du citoyen.

Une [liste de contrôle réutilisable](docs/liste-de-controle-outil-ia.md) reprend la démarche pour d'autres outils du quotidien.

## Licence

Code et contenus rédigés pour ce projet : [licence MIT](LICENSE), fournis « tels quels », sans garantie.
Les énoncés des questions proviennent d'une liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur) : ils ne sont pas couverts par cette licence et restent soumis aux conditions de réutilisation de leur source.

## Développement

Aucune dépendance, aucune étape de compilation : des fichiers statiques.

```bash
npx serve .                     # ou tout serveur de fichiers statiques
node tests/engine.test.js       # moteur, banque de questions, équilibre des choix
node tests/security.test.js     # politique de sécurité, aucune ressource externe, aucun secret
node tests/a11y.test.js         # accessibilité : contraste des palettes, focus, sémantique
```

Les tests s'exécutent aussi à chaque publication (GitHub Actions, actions épinglées sur un commit, droits en lecture seule).

## Sécurité

Application statique : pas de serveur, pas de compte, aucune donnée envoyée. Une politique de sécurité du contenu (CSP) restreint la page à ses propres fichiers : pas de script ni de style tiers, pas de requête vers un autre site. Les contenus affichés sont systématiquement échappés. Voir `tests/security.test.js`.

- `engine.js` : tirage, correction, historique (sans accès au DOM).
- `app.js` : interface.
- `data/banks.json` : toutes les questions.
- `sw.js` : service worker (hors ligne). Changer `CACHE` pour forcer le renouvellement chez les utilisateurs.
