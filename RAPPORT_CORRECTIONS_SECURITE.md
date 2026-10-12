# Rapport des corrections de sécurité — Dilemmes moraux

**Date :** 12 octobre 2026  
**Branche :** `securite/preparation-publication`  
**Référence :** [RAPPORT_SECURITE.md](RAPPORT_SECURITE.md)  
**Publication :** aucune.  
**Configuration réseau ou système :** aucune modification appliquée.

## 1. Objectif et méthode

L'objectif était de corriger les défauts identifiés, préserver les fonctionnalités et le fonctionnement local, puis préparer un futur hébergement HTTPS. Une branche dédiée a été créée avant les modifications. Les changements ne sont pas automatiquement validés par un commit ou publiés : ils restent disponibles pour examen dans cette branche.

Le travail a suivi trois étapes de vérification : serveur et dépendances, données du navigateur, puis parcours complets dans un vrai navigateur. Les tests ont été relancés lorsque de nouvelles corrections ou de nouvelles assertions le justifiaient.

L'environnement ne disposait pas de Node.js. Une archive officielle **Node 24.21.0 portable** a donc été téléchargée dans `.tools`, puis contrôlée par SHA-256 avant extraction. Son empreinte correspond à celle publiée par Node.js : `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`. Cette copie, le cache npm et les résultats temporaires sont exclus de Git. Aucune installation globale ni modification du PATH système n'a été réalisée ; les commandes ont seulement utilisé un PATH propre à leur processus.

Les dépendances ont été installées sans exécuter les scripts des paquets tiers. Le script de préparation des bibliothèques du projet a ensuite été exécuté explicitement.

## 2. Corrections effectuées, par priorité

### 2.1. Exposition du serveur et préparation HTTPS — APP-01

**Fichiers :** `server.js`, `.env.example`, `ecosystem.config.cjs`, `deployment/Caddyfile.example`, scripts de démarrage et `README.md`.

- Le serveur écoute sur `127.0.0.1:8000` par défaut. Le lancement local en HTTP est conservé.
- Le mode production exige une origine publique HTTPS exacte et une écoute sur une adresse de boucle locale.
- La confiance accordée au proxy est limitée explicitement à la boucle locale. Les valeurs trop larges, comme `TRUST_PROXY=true`, sont refusées.
- Les hôtes reçus sont contrôlés. Les redirections utilisent l'origine configurée et ne prennent pas leur destination dans les en-têtes envoyés par le visiteur.
- Les requêtes HTTP en mode production sont redirigées vers HTTPS. HSTS est ajouté uniquement dans ce mode ; les sous-domaines et le préchargement HSTS ne sont pas activés automatiquement.
- Un modèle Caddy prévoit la terminaison HTTPS sur la même machine et le remplacement des en-têtes de protocole, d'hôte et d'adresse IP du visiteur.
- Les scripts locaux n'annoncent plus une ancienne adresse Internet HTTP comme méthode de publication.

**Vérification :** fonctionnement HTTP local, simulation d'un proxy HTTPS, origine canonique, hôtes refusés et paramètres de production dangereux couverts par les tests.

**Limite :** il s'agit d'une préparation. Aucun domaine, certificat ou proxy réel n'a été configuré ; aucun port public n'a été ouvert. Le modèle Caddy n'a pas été exécuté par Caddy.

### 2.2. Mise à jour des dépendances — DEP-01 à DEP-18

| Bibliothèque | Avant | Après installation | Traitement |
| --- | --- | --- | --- |
| Express | 4.22.1 | 4.22.3 | Maintien de la version majeure 4 pour préserver la compatibilité |
| proxy-addr | 2.0.7 | 2.0.8 | Version corrigée imposée par `overrides` pour empêcher le verrouillage de conserver 2.0.7 |
| path-to-regexp | 0.1.12 | 0.1.13 | Correctif du traitement des routes |
| qs | 6.14.1 | 6.16.0 | Correctifs des trois avis recensés ; analyse des paramètres de requête désactivée car inutile au site |
| body-parser | 1.20.4 | 1.20.8 | Version corrigée résolue dans l'arbre Express ; aucun parseur de corps activé |
| jsPDF | 2.5.1 via CDN | 4.2.1 locale | Correctifs des avis recensés et vérification des exports réels |
| Chart.js | 4.4.1 via CDN | 4.5.1 locale | Mise à jour compatible avec le graphique existant |

Helmet 8.3.0 et express-rate-limit 8.7.1 ont été ajoutés pour les protections du serveur. Playwright 1.64.0 a été ajouté comme dépendance de développement pour les tests dans le navigateur.

Les versions directes sont fixées et `package-lock.json` a été actualisé. jsPDF et Chart.js sont désormais distribués depuis `public/vendor`. Les fichiers copiés depuis les paquets installés possèdent des empreintes SHA-384 utilisées dans les attributs SRI des scripts, ainsi qu'un manifeste et leurs licences.

**Résultat npm audit :** zéro vulnérabilité connue, toutes gravités confondues, y compris les dépendances de développement et les dépendances installées du navigateur. Ce résultat correspond à la consultation du registre pendant cette intervention ; il ne garantit pas l'absence de futurs avis ou de défauts inconnus.

### 2.3. Données du navigateur et injection HTML — APP-02, APP-05 et APP-07

**Fichiers :** `public/app.js`, `public/index.html`.

- Tous les usages de `innerHTML` du code applicatif ont été remplacés par la création d'éléments et l'affichage avec `textContent` ou des nœuds texte.
- La sauvegarde n'est plus copiée librement dans l'état de l'application. Seuls les champs attendus et validés sont utilisés.
- Le mode, le nom, l'index, les identifiants de questions, les choix autorisés, l'état terminé et les dates de validité sont contrôlés.
- Une sauvegarde terminée doit contenir les réponses à toutes les questions prévues.
- La taille du JSON lu est limitée à 64 K caractères. Les données trop volumineuses, incohérentes ou expirées sont ignorées sans empêcher un nouveau questionnaire.
- Les résultats, scores, profils et textes sont reconstruits depuis les questions définies dans le code et les réponses validées. Les textes et scores d'un ancien objet `result` ne sont pas utilisés.
- Les sauvegardes valides de version 1 sont migrées vers la version 2. Les réponses et une date de résultat valide sont conservées ; aucune suppression générale des anciennes sauvegardes valides n'a été effectuée par les commandes de correction.
- La nouvelle sauvegarde ne contient plus les textes du questionnaire ni les scores et profils dérivés. Elle contient uniquement la progression, le nom facultatif, le mode, les réponses, les dates et l'état terminé.
- Une sauvegarde persistante conserve la possibilité de reprendre, avec une expiration après 30 jours depuis la dernière sauvegarde. L'effacement d'une sauvegarde expirée intervient à la prochaine ouverture, pas pendant que le navigateur est fermé.
- Un choix temporaire permet de conserver la progression dans l'onglet. Lors d'un transfert, la destination est écrite avant le retrait de l'ancienne sauvegarde. Si l'écriture échoue, le mode précédent et sa sauvegarde sont conservés.
- Les erreurs d'accès, de quota et d'effacement sont gérées. Un message informe l'utilisateur lorsque la progression ne peut pas être sauvegardée.
- Les boutons sont enregistrés avant la reprise ; la réinitialisation reste accessible. Elle n'efface que les clés de progression du projet, jamais l'ensemble du stockage du navigateur.

**Modification visible indispensable à la confidentialité :** une case de conservation et un texte d'information ont été ajoutés à la configuration. La feuille de style, les images, les couleurs, les sections et les éléments affichés des questionnaires et résultats ont été conservés.

**Limites :** le stockage reste lisible par le même profil de navigateur et les scripts exécutés dans l'origine du site. Un chiffrement dont la clé serait disponible au même script ne résoudrait pas ce problème. Les réponses personnelles restent modifiables par leur propriétaire ; le profil exporté n'est pas une preuve authentifiée.

### 2.4. En-têtes, scripts et fenêtres intégrées — APP-03, APP-04 et APP-09

**Fichiers :** `server.js`, `public/index.html`, `scripts/prepare-vendor.mjs`, `public/vendor/*`.

- Les scripts du site sont locaux et les deux bibliothèques ont des empreintes SRI.
- La CSP autorise les scripts de la même origine et interdit les événements HTML contenant du JavaScript, les scripts intégrés et les connexions `fetch`/XHR.
- Les objets intégrés, formulaires et workers inutiles sont interdits ; les sources d'images et de polices sont restreintes.
- `frame-ancestors 'none'` et `X-Frame-Options: DENY` empêchent l'intégration dans une page tierce.
- `X-Content-Type-Options: nosniff` et `Referrer-Policy: no-referrer` sont activés.
- L'amélioration automatique des requêtes HTTP vers HTTPS est réservée au mode production, afin de ne pas casser l'utilisation locale.
- Les styles d'attributs restent autorisés pour préserver les styles et animations existants. Les scripts d'attributs restent interdits.

**Vérification :** les tests contrôlent les en-têtes, le contenu distribué et les empreintes. Dans Edge, un événement JavaScript ajouté à du HTML est effectivement bloqué et un événement de violation CSP est observé. Une requête sortante est également bloquée par `connect-src` ; le test fournit une réponse simulée qui réussirait sans CSP, afin d'éviter de confondre ce blocage avec un échec DNS.

La CSP limite des moyens d'exploitation, mais ne garantit pas la confidentialité si l'ensemble du serveur ou d'un script autorisé est compromis.

### 2.5. Disponibilité et erreurs — APP-06 et APP-08

**Fichiers :** `server.js`, `ecosystem.config.cjs`, `deployment/Caddyfile.example`.

- La limite par défaut est de 180 requêtes par minute et par adresse IP. Les adresses IPv6 sont regroupées par sous-réseau pour réduire le contournement par rotation d'adresses.
- Les méthodes autres que GET et HEAD sont refusées ; aucun traitement de corps de requête n'est ajouté.
- Les adresses de plus de 2048 caractères sont refusées.
- Le temps de réception d'une requête est limité à 15 secondes, celui des en-têtes à 10 secondes ; la connexion persistante inactive est bornée à 5 secondes et l'inactivité générale à 30 secondes.
- Une connexion est limitée à 100 requêtes.
- Le modèle du proxy borne le corps à 1 Mo et définit des délais de transport.
- La configuration PM2 prévoit un processus unique, une temporisation de redémarrage et un seuil mémoire de 256 Mo.
- Les erreurs envoyées au navigateur sont génériques dans tous les modes et `X-Powered-By` est désactivé.

**Vérification :** statut 429, en-têtes de limitation, regroupement IPv6, refus des méthodes, hôtes et adresses trop longues, délais configurés, fichiers privés et erreurs sans chemins internes couverts par les tests.

**Limites :** la limitation est en mémoire et se réinitialise avec le processus. Elle ne protège pas à elle seule contre un déni de service distribué. Les réglages PM2/Caddy ne sont que préparés, pas appliqués à un service réel.

## 3. Fichiers modifiés ou ajoutés

| Fichier | Action et rôle |
| --- | --- |
| `server.js` | Modifié : configuration validée, écoute locale, sécurité HTTP, proxy, limites et erreurs ; fonctions exportées pour les tests |
| `package.json` | Modifié : versions, override proxy-addr, versions Node et commandes de préparation/test |
| `package-lock.json` | Modifié : arbre des dépendances corrigé et verrouillé |
| `public/app.js` | Modifié : validation, migration, stockage, rendu texte et robustesse de la reprise |
| `public/index.html` | Modifié : scripts locaux avec SRI et information/choix de conservation |
| `.gitignore` | Modifié : exclusion des outils portables, caches associés, résultats de tests, journaux et fichiers d'environnement privés |
| `START_SITE.bat`, `START_SITE_AUTO.bat` | Modifiés : configuration PM2 locale et traitement d'une erreur de lancement |
| `README.md` | Modifié : lancement correct, sauvegardes, tests, Node et préparation de déploiement |
| `.env.example` | Ajouté : exemple de variables, sans activation automatique |
| `.node-version` | Ajouté : branche Node 24 recommandée |
| `ecosystem.config.cjs` | Ajouté : profils PM2 local et production, sans lancement |
| `deployment/Caddyfile.example` | Ajouté : exemple HTTPS/proxy, sans installation ni application |
| `scripts/prepare-vendor.mjs` | Ajouté : copie des bibliothèques, licences, empreintes et balises SRI |
| `public/vendor/jspdf.4.2.1.umd.min.js` | Ajouté : bibliothèque PDF locale corrigée |
| `public/vendor/chart.4.5.1.umd.min.js` | Ajouté : bibliothèque de graphique locale |
| `public/vendor/jspdf.LICENSE.txt`, `public/vendor/chart.js.LICENSE.txt` | Ajoutés : licences des bibliothèques distribuées |
| `public/vendor/manifest.json` | Ajouté : versions, noms et empreintes des fichiers copiés |
| `playwright.config.mjs` | Ajouté : navigateur isolé et serveur local de test |
| `tests/server.test.mjs` | Ajouté : tests HTTP, configuration, fichiers, limites et intégrité |
| `tests/browser-state.test.mjs` | Ajouté : migration, sauvegardes, scores et erreurs de stockage |
| `tests/e2e/application.spec.mjs` | Ajouté : parcours dans un navigateur et téléchargements réels |
| `RAPPORT_SECURITE.md` | Mis à jour : tableau d'état des corrections ; audit initial conservé comme historique |
| `RAPPORT_CORRECTIONS_SECURITE.md` | Ajouté : présent rapport |

`public/style.css`, `public/logo.png`, `public/favicon.png` et `STOP_SITE.bat` n'ont pas été modifiés. Les questions, options, poids et sélection du mode rapide ont été comparés à la branche `main` : ils sont identiques. Aucun compte, API ou service extérieur n'a été modifié.

## 4. Tests réalisés et résultats

### 4.1. Environnement et résultat général

- Node.js : 24.21.0 portable.
- npm : 11.19.0, fourni avec la copie portable.
- Playwright : 1.64.0.
- Navigateur : Microsoft Edge 155.0.4283.45, déjà installé, lancé sans fenêtre visible avec un profil isolé.
- Tests HTTP : adresses de boucle locale et ports temporaires.
- Tests navigateur : `127.0.0.1:18080`, sans serveur public.

**Résultat : 22 tests distincts réussis**, répartis en 16 tests unitaires/d'intégration et six scénarios de navigateur. Aucun scénario n'a été sauté dans ces deux suites. Une vérification ciblée supplémentaire du scénario CSP a aussi réussi après renforcement de ses assertions.

Le premier lancement des tests navigateur dans le bac à sable a passé ses six scénarios, mais sa fermeture est restée bloquée. Il a été interrompu et n'a pas été compté comme une suite terminée avec succès. Une nouvelle exécution hors du bac à sable, autorisée, s'est terminée normalement avec un code de sortie 0. Aucun profil de navigateur personnel n'a été utilisé.

### 4.2. Commandes de validation

Les commandes ont utilisé le Node portable dans le PATH du processus. Les mêmes vérifications sont accessibles avec une installation Node maintenue :

```powershell
node --check server.js
node --check public/app.js
node --check ecosystem.config.cjs
npm run vendor
npm test
npm run test:e2e
npm run test:e2e -- --grep "CSP effective"
npm audit --json
npm ls express proxy-addr path-to-regexp qs body-parser helmet express-rate-limit jspdf chart.js
git diff --check
```

La liste des versions réellement résolues a confirmé notamment `proxy-addr@2.0.8`, `path-to-regexp@0.1.13`, `qs@6.16.0` et `body-parser@1.20.8`. L'audit npm a retourné un objet de vulnérabilités vide et un total de zéro.

### 4.3. Détail des 16 tests unitaires et d'intégration

| Groupe | Vérification | Résultat |
| --- | --- | --- |
| Serveur | Page, JavaScript, CSS, images, route `/test` et HEAD | Réussi |
| En-têtes | CSP, scripts d'attributs interdits, cadres, types, référent et absence de HSTS en local | Réussi |
| Fichiers et erreurs | `.env`, `.git`, racine privée, traversées de chemin et encodage malformé non divulgués | Réussi |
| Requêtes | POST refusé, hôte inattendu refusé et adresse trop longue refusée | Réussi |
| Débit local | Seuil et statut 429, sans contournement par un en-tête IP transmis au serveur local | Réussi |
| Production simulée | Redirection canonique, protocole HTTPS reconnu depuis le proxy local, HSTS et hôtes contrôlés | Réussi |
| IPv6 | Rotation d'adresses d'un même sous-réseau soumise à la même limite | Réussi |
| Configuration | Origine, proxy, écoute et valeurs numériques dangereuses refusés | Réussi |
| Connexions | Écoute locale, délais et nombre de requêtes par connexion bornés | Réussi |
| Bibliothèques | Fichiers locaux servis et empreintes SRI correspondant aux octets copiés | Réussi |
| Migration | Ancienne sauvegarde valide conservée ; HTML et scores falsifiés non utilisés | Réussi |
| Résultats | Modes 30/12 questions, scores de référence et reprise identique du résultat | Réussi |
| Sauvegardes | JSON invalide, taille excessive, index, choix, clés et dates invalides rejetés | Réussi |
| Stockage refusé | Test et réinitialisation utilisables malgré les erreurs d'accès/quota | Réussi |
| Mode temporaire | Transfert, reprise d'onglet et effacement limité aux clés du projet | Réussi |
| Transfert refusé | Ancienne progression préservée si la destination est indisponible | Réussi |

Les scores de référence ont été calculés depuis le code initial de `main`, pour des réponses A à toutes les questions. Les tests comparent les scores bruts et normalisés à ces valeurs fixes, et pas seulement au résultat recalculé par le même code modifié.

### 4.4. Détail des six scénarios dans Edge

| Scénario | Vérifications | Résultat |
| --- | --- | --- |
| Questionnaire complet | 30 réponses, sélection A/B/C, résultats, nom affiché comme texte, graphique réellement dessiné, quatre téléchargements, reprise et réinitialisation | Réussi |
| Questionnaire rapide | Même parcours pour 12 réponses, avec tous les exports | Réussi |
| Progression partielle | Navigation précédente, sélection au clavier, stockage d'onglet, reprise et retour au menu par le logo | Réussi |
| Ancienne sauvegarde malveillante | Résultat reconstruit, aucun élément HTML malveillant créé, aucune exécution, migration sans objet `result` stocké | Réussi |
| Stockage entièrement bloqué | Parcours rapide complet, export JSON et réinitialisation malgré le refus du navigateur | Réussi |
| CSP effective | Script d'événement HTML bloqué et connexion sortante bloquée avec événements de violation observés | Réussi |

Les exports PDF sont produits par la véritable bibliothèque dans le navigateur, et non par un remplacement de jsPDF dans un test. Leur signature `%PDF-`, leur marqueur de fin `%%EOF` et la présence de contenu attendu sont contrôlés. Les exports JSON sont analysés et vérifiés, notamment les questions, réponses, scores et le résultat repris.

Les exemples PDF/JSON des tests sont conservés dans des sous-dossiers de `test-results`, exclus de Git, pour consultation. Ces fichiers contiennent seulement des réponses de test. Les tests ne comparent pas visuellement chaque page PDF ni chaque pixel de l'interface.

### 4.5. Comparaisons de non-régression

- Les données des 30 questions, leurs options, leurs poids et les identifiants du mode rapide ont été comparés au code initial de `main` et sont identiques.
- La feuille de style et les deux images ont été comparées à `main` et sont inchangées.
- Les noms des téléchargements et les formats d'export du questionnaire et des résultats sont conservés.
- Les résultats terminés gardent une date valide lors de la migration et de la reprise.
- Le mode rapide, le mode complet, le choix au clavier, les boutons précédent/suivant, le logo de retour au menu et la réinitialisation sont conservés.
- Le repli texte lorsque jsPDF est indisponible reste présent dans le code ; le navigateur avec la bibliothèque locale vérifiée utilise bien les exports PDF.

## 5. Vérifications non réalisées et risques restants

| Point | État et action restante |
| --- | --- |
| HTTPS réel | Non testé : aucun domaine ou certificat n'a été installé. Vérifier la chaîne TLS, les redirections et HSTS sur le futur hébergement. |
| Caddy | Non installé et modèle non validé par son outil. Adapter les variables, valider la configuration puis tester les en-têtes écrasés et l'accès au serveur local. |
| PM2 | Non installé ici : syntaxe de la configuration vérifiée par Node, mais pas de lancement/rechargement/arrêt réel ni de test du seuil mémoire. Vérifier la version externe et les scripts Windows avant utilisation. |
| Pare-feu, routeur, DNS, service système | Aucune modification effectuée et état non contrôlé. Vérifier ces éléments uniquement dans le périmètre et avec l'autorisation de déploiement. |
| Droits du service | Compte de service et permissions du futur hébergement inconnus. Utiliser des droits limités. |
| Déni de service distribué | Non simulé. La limite applicative ne remplace pas une protection d'infrastructure contre un grand volume de visiteurs malveillants. |
| Plusieurs instances | Pas activées. Un stockage de quotas commun ou une limitation en amont sera nécessaire si le nombre de processus augmente. |
| Données locales | Pas de chiffrement ni séparation entre personnes partageant le même profil. L'effacement automatique d'une sauvegarde expirée attend la prochaine ouverture. Les exports restent sur l'appareil après réinitialisation. |
| Changement d'origine | Le futur domaine HTTPS possède un stockage distinct de localhost. Aucune migration distante des réponses n'a été ajoutée. |
| Autres navigateurs et moteurs Node | Tests exécutés sous Edge/Node 24 uniquement ; Firefox, Safari, Node 22 et Node 26 n'ont pas été testés. |
| Mise en page des PDF | Génération et contenu testés, mais aucune comparaison visuelle exhaustive ou contrôle d'accessibilité des PDF. |
| Maintenance | L'audit npm sans alerte vaut à la date de consultation. Revérifier les dépendances et bibliothèques locales avant publication et régulièrement ensuite. |

Aucune installation globale de PM2, de Caddy ou de navigateur n'a été effectuée. Aucune configuration de certificat, de pare-feu, de routeur ou de démarrage automatique système n'a été appliquée.

## 6. Étapes recommandées avant publication

1. Examiner les modifications de la branche et les deux rapports.
2. Choisir le domaine, la machine et le mode d'hébergement.
3. Vérifier les versions et les droits du moteur Node et du gestionnaire de processus sur cette machine.
4. Après autorisation, configurer le proxy HTTPS, le certificat et les règles réseau nécessaires.
5. Vérifier que le port Node reste privé et que les en-têtes envoyés par le visiteur sont correctement remplacés par le proxy.
6. Exécuter les tests sur l'environnement prévu et contrôler les en-têtes et redirections réellement reçus.
7. Prévoir supervision, mises à jour et protections contre les attaques volumétriques.
8. Publier seulement après autorisation explicite.

## 7. Conclusion

Les défauts de rendu HTML, de reprise des sauvegardes, de distribution des bibliothèques et de protection HTTP ont été corrigés dans le code. Les versions affectées recensées ont été remplacées et l'audit npm ne retourne aucune vulnérabilité connue. Les fonctionnalités principales sont conservées et couvertes par des tests dans un véritable navigateur.

Le projet peut continuer à fonctionner localement et dispose d'une configuration préparée pour un proxy HTTPS. **Il n'a pas été publié et sa sécurité sur un futur hébergement public n'est pas encore validée.** Les principaux travaux restants concernent cet hébergement, les certificats, les règles réseau, la supervision et la protection contre les attaques volumétriques.

La confidentialité locale dépend également de l'accès au profil du navigateur. Le choix temporaire, l'expiration et la réinitialisation réduisent ce risque, sans transformer les résultats en données chiffrées ou authentifiées.
