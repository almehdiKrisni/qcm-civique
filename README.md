# QCM Civique

Application web d'entraînement au QCM de l'examen civique pour la naturalisation française. Elle fonctionne dans le navigateur, s'installe sur l'écran d'accueil d'un iPhone ou d'un Android et marche hors ligne une fois chargée.

> **Projet personnel et non officiel.** Les questions « maison » et **toutes les réponses** sont rédigées par une IA (Claude) et peuvent contenir des erreurs. Vérifiez avec le [Livret du citoyen](https://www.immigration.interieur.gouv.fr/) du ministère de l'Intérieur.

## Fonctions

- Séries de 10, 20 ou 30 questions par catégorie, ou tirées dans toutes les catégories.
- Simulation de 40 questions, tirage équilibré entre catégories, seuil de réussite de 80 % (32/40).
- **Mode examen officiel** (thème bleu-blanc-rouge) : uniquement les questions de la liste officielle publiée par la Direction générale des étrangers en France (ministère de l'Intérieur, 12/01/2026).
- Résultat détaillé : toutes les questions posées, votre réponse, la bonne réponse et la justification.
- Reprise des erreurs d'une série en tentatives successives, avec le détail de chaque tentative dans l'historique.
- Aucune donnée envoyée : l'historique reste dans le navigateur de l'appareil. Export et import (fusion) pour le sauvegarder ou le transférer.

## Les questions officielles

La liste officielle ne contient que les **énoncés**. Elle ne donne ni les choix de réponses ni les corrections : ceux de ce projet sont rédigés par l'IA, certains sont signalés « réponse à confirmer ». Une question apparaît en double dans la liste publiée (une seule est conservée) et une ligne du PDF était illisible (ignorée) : 243 questions au total.

## Installer sur iPhone

1. Ouvrir l'adresse du site dans **Safari**.
2. Toucher Partager, puis « Sur l'écran d'accueil ».
3. Lancer l'application depuis son icône. Elle fonctionne sans connexion après le premier chargement.

Installer l'application sur l'écran d'accueil protège aussi l'historique : dans un simple onglet Safari, iOS peut effacer les données d'un site peu utilisé. Pensez à exporter l'historique de temps en temps.

## Licence

Code et contenus rédigés pour ce projet : [licence MIT](LICENSE), fournis « tels quels », sans garantie.
Les énoncés du mode officiel proviennent d'une liste publiée par la Direction générale des étrangers en France (ministère de l'Intérieur) : ils ne sont pas couverts par cette licence et restent soumis aux conditions de réutilisation de leur source.

## Développement

Aucune dépendance, aucune étape de compilation : des fichiers statiques.

```bash
python -m http.server 8000      # puis ouvrir http://localhost:8000
node tests/engine.test.js       # tests du moteur
```

- `engine.js` : tirage, correction, historique (sans accès au DOM).
- `app.js` : interface.
- `data/banks.json` : toutes les questions (maison et officielles).
- `sw.js` : service worker (hors ligne). Changer `CACHE` pour forcer le renouvellement chez les utilisateurs.
