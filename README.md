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

## Licence

Code et contenus rédigés pour ce projet : [licence MIT](LICENSE), fournis « tels quels », sans garantie.
Les énoncés des questions proviennent d'une liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur) : ils ne sont pas couverts par cette licence et restent soumis aux conditions de réutilisation de leur source.

## Développement

Aucune dépendance, aucune étape de compilation : des fichiers statiques.

```bash
npx serve .                     # ou tout serveur de fichiers statiques
node tests/engine.test.js       # moteur, banque de questions, équilibre des choix
node tests/security.test.js     # politique de sécurité, aucune ressource externe, aucun secret
```

Les tests s'exécutent aussi à chaque publication (GitHub Actions, actions épinglées sur un commit, droits en lecture seule).

## Sécurité

Application statique : pas de serveur, pas de compte, aucune donnée envoyée. Une politique de sécurité du contenu (CSP) restreint la page à ses propres fichiers : pas de script ni de style tiers, pas de requête vers un autre site. Les contenus affichés sont systématiquement échappés. Voir `tests/security.test.js`.

- `engine.js` : tirage, correction, historique (sans accès au DOM).
- `app.js` : interface.
- `data/banks.json` : toutes les questions.
- `sw.js` : service worker (hors ligne). Changer `CACHE` pour forcer le renouvellement chez les utilisateurs.
