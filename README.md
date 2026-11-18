# QCM Civique

Application d'entraînement au QCM de l'examen civique pour la naturalisation française. Elle fonctionne dans le navigateur, s'installe sur l'écran d'accueil d'un téléphone et marche hors ligne une fois chargée.

> Application non officielle. Les réponses et explications sont préparées avec l'aide d'une IA : en cas de doute, la référence est le Livret du citoyen du ministère de l'Intérieur.

## Deux modes

- **Examen officiel** (par défaut, thème bleu-blanc-rouge) : les questions de la liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur, janvier 2026).
- **Complémentaire** : des questions supplémentaires pour approfondir chaque thème.

## Fonctions

- Séries de 10, 20 ou 30 questions par catégorie, ou tirées dans toutes les catégories.
- Simulation de 40 questions, tirage équilibré entre catégories, seuil de réussite de 80 % (32/40).
- « En savoir plus » sous chaque question : l'essentiel à retenir, le contexte et la page du Livret du citoyen (édition de mai 2026) quand le sujet y figure.
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
Les énoncés du mode « Examen officiel » proviennent d'une liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur) : ils ne sont pas couverts par cette licence et restent soumis aux conditions de réutilisation de leur source.

## Développement

Aucune dépendance, aucune étape de compilation : des fichiers statiques.

```bash
npx serve .                     # ou tout serveur de fichiers statiques
node tests/engine.test.js       # tests du moteur
```

- `engine.js` : tirage, correction, historique (sans accès au DOM).
- `app.js` : interface.
- `data/banks.json` : toutes les questions.
- `sw.js` : service worker (hors ligne). Changer `CACHE` pour forcer le renouvellement chez les utilisateurs.
