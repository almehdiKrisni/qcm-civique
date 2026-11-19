# Liste de contrôle : créer un outil du quotidien avec une IA

Une démarche pour passer de « l'IA a écrit quelque chose qui marche » à « j'ai un outil fiable que je peux partager ». Elle est tirée de la construction de QCM Civique ; adaptez-la. Cochez chaque ligne, ou notez pourquoi elle ne s'applique pas.

> Cette liste convient à un outil **local, sans donnée sensible**. Pour des paiements, des données de santé, des données d'autres personnes ou un usage professionnel, faites relire par un expert.

## 1. Le besoin
- [ ] Je peux décrire en une phrase le problème et qui l'utilise.
- [ ] Je sais ce que l'outil ne fera pas (limites assumées).
- [ ] Un outil existant ne répond-il pas déjà au besoin ? Si oui, pourquoi en faire un autre ?

## 2. Les données et la vie privée
- [ ] Quelles données l'outil manipule-t-il ? Y a-t-il des données personnelles ou sensibles ?
- [ ] Le plus possible reste sur l'appareil de l'utilisateur ; rien n'est envoyé sans nécessité.
- [ ] Aucun fichier personnel (historique, résultats, identifiants) n'est dans ce qui sera publié (vérifier `.gitignore`).
- [ ] Mon identité (nom, adresse) n'apparaît dans le projet que si je l'ai décidé.

## 3. Les sources et l'exactitude
- [ ] Le contenu vient d'une source de référence que j'ai moi-même fournie ou identifiée.
- [ ] J'ai relu et recoupé ce que l'IA a produit : elle se trompe avec assurance (chiffres, dates, pages).
- [ ] Je cherche ce que l'IA a pu **omettre** (comparer avec la source, par exemple par lecture optique d'un PDF).
- [ ] Les points incertains sont signalés, pas cachés.

## 4. La sécurité
- [ ] Aucune dépendance inutile ; chaque dépendance est justifiée et à jour.
- [ ] Aucun secret (clé, jeton, mot de passe) dans le code ni dans l'historique du dépôt.
- [ ] Pour une page web : politique de sécurité du contenu (CSP) stricte, aucune ressource externe, contenus affichés échappés.
- [ ] Compte de publication protégé (double authentification, codes de récupération conservés hors ligne).
- [ ] Jetons d'outils en ligne de commande : droits minimaux, révoqués quand ils ne servent plus.
- [ ] Automatisation (GitHub Actions…) : versions épinglées sur un commit, droits en lecture seule.

## 5. L'accessibilité
- [ ] Contraste du texte d'au moins 4,5:1, en thème clair et sombre.
- [ ] Tout se fait au clavier ; l'indicateur de focus est visible.
- [ ] Zones tactiles d'au moins 44 px ; zoom autorisé ; pas de défilement horizontal à 320 px.
- [ ] Les informations ne reposent pas sur la couleur seule.
- [ ] Les composants ont la bonne sémantique (titres, boutons radio, boîtes de dialogue, zones annoncées).
- [ ] Mouvement réduit respecté ; langue de la page déclarée.
- [ ] Mesure **avant** et **après** les corrections, puis test automatique pour éviter les régressions.
- [ ] Essai avec un lecteur d'écran réel si possible (les contrôles automatiques ne suffisent pas).

## 6. La qualité
- [ ] Des tests automatiques vérifient ce qui compte (calculs, contenu, sécurité, accessibilité).
- [ ] Un test réussit-il vraiment pour la bonne raison ? Le faire échouer exprès une fois.
- [ ] J'ai essayé l'outil comme un utilisateur (téléphone, hors ligne, erreurs, cas limites), pas seulement lu le code.
- [ ] Je compare avec le comportement réel (ex. l'examen réel) plutôt qu'avec mes suppositions.

## 7. La transparence
- [ ] Il est écrit que l'outil est construit avec une IA, et qu'il n'est pas officiel s'il traite d'un sujet officiel.
- [ ] Les limites et les risques d'erreur sont dits clairement, avec la référence à consulter.
- [ ] Une licence est choisie ; les contenus de tiers gardent leurs conditions de réutilisation.
- [ ] Il existe un moyen de signaler une erreur.

## 8. La publication
- [ ] Je relis exactement ce qui part en ligne (fichiers, noms, historique) avant de publier.
- [ ] Je vérifie la version **en ligne**, pas seulement la version locale (cache, mise à jour du service worker).
- [ ] Les tests tournent à chaque publication et passent.

## 9. La maintenance
- [ ] Je sais comment corriger une erreur et republier.
- [ ] Une date de dernière vérification des contenus est notée.
- [ ] Je sais quand arrêter : suppression ou passage en privé du dépôt si l'outil n'a plus d'utilité.

## Se rappeler
L'IA accélère ; elle ne remplace ni la vérification des sources, ni la décision de ce qu'on publie, ni la responsabilité de ce qu'on affirme.
