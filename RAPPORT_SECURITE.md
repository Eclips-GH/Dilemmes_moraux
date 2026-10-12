# Rapport de sécurité — Dilemmes moraux

**Date de l'audit :** 12 octobre 2026  
**Périmètre :** copie locale du projet et historique Git disponible.  
**Méthode :** lecture du code et des configurations, suivi des flux de données, recherche ciblée de secrets et consultation des avis de sécurité des dépendances.  
**État des corrections :** corrections du code réalisées sur la branche `securite/preparation-publication`, après autorisation de l'utilisateur. La publication publique et les changements de configuration réseau ou système n'ont pas été effectués.

> Ce rapport distingue les défauts constatés dans le code, les risques qui dépendent du déploiement et les alertes de bibliothèques dont les fonctions vulnérables ne sont pas utilisées. Une alerte « critique » sur une bibliothèque ne signifie pas automatiquement que le site est attaquable par ce moyen.

## Suivi des corrections — 12 octobre 2026

Les sections numérotées 1 à 8 ci-dessous conservent **l'état initial audité**, ses explications et ses sources. Les anciennes versions de bibliothèques et les constats formulés au présent dans ces sections décrivent cet état historique. Le tableau suivant indique l'état après correction ; les détails et résultats actuels figurent dans [RAPPORT_CORRECTIONS_SECURITE.md](RAPPORT_CORRECTIONS_SECURITE.md).

| Problème initial | État après correction | Correction ou travail restant |
| --- | --- | --- |
| APP-01 — Accès HTTP public et écoute sur toutes les interfaces | Corrigé pour le lancement local ; publication HTTPS préparée, non validée en situation réelle | Écoute locale par défaut et obligatoire en production. Origine HTTPS, proxy local explicite, redirection canonique et HSTS en production. Restent le domaine, le certificat, le proxy et la vérification du pare-feu avant publication. |
| Version de Node sans support possible | Exigence et environnement de test corrigés ; machine de déploiement à vérifier | Node 24 LTS recommandé, branches maintenues déclarées dans `engines`, tests sous Node portable 24.21.0. Aucune installation système n'a été remplacée. |
| APP-02 — Injection HTML depuis une sauvegarde | Corrigé dans le code | Suppression de `innerHTML`, validation des réponses et reconstruction des résultats ; les anciens scores, profils et textes sauvegardés ne sont pas réutilisés. |
| APP-03 — Scripts externes sans intégrité | Corrigé | jsPDF et Chart.js servis localement, versions verrouillées, empreintes SRI et licences conservées. Aucun CDN nécessaire à l'exécution du site. |
| APP-04 — Absence de CSP | Corrigé et testé dans le navigateur | CSP restreignant scripts, connexions, objets, formulaires et intégration. Les styles d'attributs restent autorisés pour conserver l'apparence ; les scripts d'attributs sont interdits. |
| APP-05 — Conservation durable des données | Atténué ; confidentialité du profil de navigateur à protéger | Choix de sauvegarde persistante ou d'onglet, information visible, expiration de reprise à 30 jours et effacement ciblé. Le stockage reste lisible dans le même profil ; l'effacement des données expirées intervient à la prochaine ouverture. |
| APP-06 — Saturation du serveur | Protections applicatives ajoutées ; protections d'hébergement encore nécessaires | Limitation à 180 requêtes/minute, prise en compte des sous-réseaux IPv6, délais et connexions bornés, configuration PM2 à mémoire limitée. Le déni de service distribué et le déploiement multi-instance nécessitent des protections d'infrastructure. |
| APP-07 — Sauvegarde invalide bloquant l'interface | Corrigé | Validation, limite de taille, gestion des erreurs de stockage, migration compatible et réinitialisation toujours accessible. |
| APP-08 — Divulgation d'erreurs et `X-Powered-By` | Corrigé dans le serveur ; mode PM2 public préparé | Réponses d'erreur génériques dans tous les modes, en-tête désactivé, configuration explicite du mode production. PM2 externe non installé et non testé. |
| APP-09 — Intégration dans une page tierce | Corrigé | `frame-ancestors 'none'` et `X-Frame-Options: DENY`. |
| DEP-01 à DEP-18 — Versions de dépendances affectées | Versions corrigées installées et vérifiées | Express 4.22.3, proxy-addr 2.0.8, path-to-regexp 0.1.13, qs 6.16.0, body-parser 1.20.8 et jsPDF 4.2.1. L'audit npm après mise à jour retourne zéro vulnérabilité connue, développement inclus. |
| README obsolète | Corrigé | Instructions du serveur sur le port 8000, sauvegarde, tests, versions Node et préparation HTTPS actualisées. |

**Validation actuelle :** 16 tests unitaires/d'intégration réussis et six scénarios dans un vrai navigateur Edge réussis. Le test CSP a également été renforcé et vérifié séparément. Les parcours, migrations, scores de référence, graphiques et exports PDF/JSON sont couverts. Les limites de validation de Caddy, PM2 et du futur hébergement sont détaillées dans le rapport des corrections.

**Conclusion actuelle :** le code est durci et le lancement local sécurisé est conservé. La sécurité d'un futur déploiement public n'est pas certifiée : celui-ci devra être autorisé, configuré et vérifié avec son domaine, son certificat et ses règles réseau. Les risques locaux liés au partage d'un profil de navigateur et les attaques volumétriques restent à considérer.

## 1. Présentation du projet et fonctionnement

### 1.1. Objectif de l'application

Dilemmes moraux est un questionnaire interactif sur les choix éthiques. L'utilisateur peut saisir un nom d'affichage, choisir un questionnaire complet de 30 questions ou un questionnaire rapide de 12 questions, puis sélectionner une réponse à chaque situation.

L'application calcule des scores selon dix axes, notamment l'empathie, l'honnêteté, la liberté et la solidarité. Elle affiche un profil, un graphique radar et un récapitulatif des réponses. Elle propose des téléchargements au format JSON et PDF.

### 1.2. Architecture

| Élément | Fonction | Emplacement |
| --- | --- | --- |
| Serveur Node.js avec Express | Sert les fichiers du site sur le port 8000 | [server.js](server.js) |
| Route `GET /test` | Retourne un message fixe indiquant que le serveur fonctionne | `server.js`, ligne 16 |
| Page HTML | Contient les sections de configuration, questionnaire et résultats | [public/index.html](public/index.html) |
| Code du navigateur | Gère les questions, les réponses, les calculs, la sauvegarde et les exports | [public/app.js](public/app.js) |
| Feuille de style et images | Présentation visuelle du site | [public/style.css](public/style.css), `public/logo.png`, `public/favicon.png` |
| Scripts Windows | Démarrent et arrêtent le serveur avec PM2 | [START_SITE.bat](START_SITE.bat), [START_SITE_AUTO.bat](START_SITE_AUTO.bat), [STOP_SITE.bat](STOP_SITE.bat) |
| Dépendances du serveur | Déclarent Express et verrouillent les versions de ses dépendances | [package.json](package.json), [package-lock.json](package-lock.json) |

Le serveur écoute sur `0.0.0.0`, c'est-à-dire sur toutes les interfaces réseau de la machine. Cela autorise techniquement des connexions autres que celles de la machine elle-même, sous réserve du pare-feu et de la configuration réseau.

### 1.3. Circulation et conservation des données

1. Le navigateur récupère les fichiers du site auprès du serveur.
2. Il charge jsPDF 2.5.1 et Chart.js 4.4.1 depuis le service externe jsDelivr, en HTTPS.
3. Le nom d'affichage et les réponses sont traités dans le navigateur.
4. La progression et les résultats sont enregistrés dans `localStorage`, avec la clé `dm_local_v3`.
5. Les scores et le profil sont calculés dans le navigateur.
6. Les exports JSON et PDF sont générés dans le navigateur et téléchargés par l'utilisateur.

`localStorage` est un espace de stockage propre au site dans le profil du navigateur. Ses données persistent généralement après la fermeture de la page et du navigateur, jusqu'à leur effacement. Elles sont accessibles aux scripts exécutés dans le contexte de ce site.

Le code applicatif examiné ne transmet pas les réponses au serveur. Il n'utilise ni base de données, ni compte utilisateur, ni authentification, ni API de sauvegarde distante. Le serveur reçoit toutefois les requêtes nécessaires à la distribution des fichiers. Le CDN reçoit les requêtes de chargement des bibliothèques. Le comportement effectif de l'hébergement et les éventuels journaux externes n'ont pas été vérifiés.

## 2. Éléments analysés et limites de vérification

### 2.1. Fichiers et composants examinés

Les 13 fichiers du projet présents avant la création de ce rapport ont été examinés :

- `server.js` : routes, dossier publié, exposition réseau et configuration de sécurité.
- `public/app.js` : questions, calcul des scores, sources des données, affichage HTML, sauvegarde, reprise, réinitialisation et exports.
- `public/index.html` : saisies, ressources externes, scripts et structure de la page.
- `public/style.css` : règles de présentation et recherche de ressources externes.
- `public/logo.png` et `public/favicon.png` : signature et structure des fichiers PNG. Aucun bloc de métadonnées textuelles ou octets supplémentaires après la fin des images n'a été relevé. Il ne s'agit pas d'une certification des décodeurs d'images.
- `package.json` et `package-lock.json` : dépendances, versions, origines des téléchargements, empreintes d'intégrité et indicateurs de scripts d'installation.
- `START_SITE.bat`, `START_SITE_AUTO.bat` et `STOP_SITE.bat` : commandes PM2 et informations de déploiement.
- `.gitignore` : exclusions des dépendances et du fichier `.env`.
- `README.md` : instructions de lancement et versions de Node.js recommandées.

Le fichier de verrouillage contient **68 entrées de paquets correspondant à 67 noms distincts**, avec Express 4.22.1 comme dépendance directe. Deux versions de `ms` expliquent la différence entre le nombre d'entrées et le nombre de noms.

Une consultation de l'interface d'avis de sécurité du registre npm a été effectuée pour ces versions et pour les versions déclarées de jsPDF et Chart.js. Seuls les noms et versions des paquets ont été transmis : aucun code source, réponse au questionnaire ou secret n'a été envoyé pour cette vérification.

La consultation a retourné **18 avis concernant cinq bibliothèques**. Les conditions de déclenchement ont été comparées aux fonctions utilisées dans le projet. Les dépendances chargées par CDN nécessitent cette vérification séparée : elles ne figurent pas dans `package-lock.json`.

Une recherche ciblée de formats courants de clés privées, jetons et identifiants secrets a également été réalisée dans les fichiers textuels et les six commits Git disponibles. Aucun résultat n'a été relevé. Cette recherche ne couvre pas tous les formats possibles de secrets. Les fichiers internes de Git n'ont pas été considérés comme du code distribué par l'application.

### 2.2. Éléments non vérifiés

| Élément | Limite et conséquence |
| --- | --- |
| Exécution réelle de l'application | Node.js, npm et PM2 n'étaient pas accessibles dans l'environnement de commande. Aucun serveur n'a été démarré. |
| Dépendances effectivement installées | Le dossier `node_modules` est absent. Leurs fichiers installés n'ont pas pu être inspectés ou comparés au verrouillage. |
| Exploitation des défauts | Aucun essai d'injection dans le navigateur, test d'exploitation ou test de charge n'a été exécuté. Les constats applicatifs reposent sur le suivi du code. |
| Site accessible depuis Internet | L'adresse publique annoncée dans le script n'a pas été sollicitée. Son accessibilité et son appartenance actuelle au déploiement ne sont pas établies. |
| HTTPS et en-têtes du site hébergé | Aucun certificat ni aucune réponse HTTP du déploiement réel n'a été contrôlé. Un proxy extérieur au dépôt pourrait déjà fournir certaines protections. |
| Pare-feu et routeur | Les règles entrantes, redirections de ports et restrictions réseau ne sont pas fournies dans le projet. |
| Configuration externe de PM2 | La version de PM2, les variables d'environnement, les privilèges du processus et les limites de ressources ne sont pas connus. |
| Version de Node.js déployée | La documentation autorise des versions anciennes, mais la version réellement utilisée n'a pas pu être déterminée. |
| Journaux et supervision | La présence de journaux d'accès, d'alertes ou de protections fournies par un hébergeur n'est pas établie. |
| Code distribué par le CDN | Les versions déclarées ont été vérifiées contre les avis. Aucune analyse exhaustive des fichiers minifiés et de tous leurs composants intégrés n'a été réalisée. |

Les avis de sécurité sont ceux consultés à la date de l'audit. De nouveaux avis peuvent apparaître ensuite.

### 2.3. Comment lire les gravités

- **Critique :** peut permettre une compromission majeure, si les conditions décrites sont réunies.
- **Élevée :** peut entraîner un impact important sur les données, le fonctionnement ou la confiance dans le site.
- **Moyenne :** risque réel mais limité par des conditions d'exploitation ou par la portée actuelle de l'application.
- **Faible :** impact limité, divulgation technique ou défaut de robustesse principalement local.

Pour chaque constat, le rapport indique son statut : **défaut constaté**, **risque conditionnel** ou **alerte de dépendance sans chemin d'exploitation identifié dans le code actuel**. Les gravités des avis de dépendances sont celles retournées par le registre npm lors de l'audit.

## 3. Vulnérabilités et risques classés par gravité

### 3.1. Gravité critique

**Aucune faille critique exploitable à distance n'a été démontrée dans l'application.** Trois avis critiques concernent toutefois les versions déclarées de bibliothèques. Ils doivent être traités lors de la maintenance des dépendances, même si leurs conditions de déclenchement sont absentes du code examiné.

#### DEP-01 — Usurpation d'adresse IP avec proxy-addr

- **Version et fichier :** `proxy-addr` 2.0.7, `package-lock.json`, entrée située à la ligne 569 ; dépendance utilisée par Express.
- **Explication simple :** certaines configurations de confiance accordée aux proxys peuvent faire croire au serveur qu'un visiteur possède une autre adresse IP.
- **Risque :** contourner une restriction par IP, une limitation de débit ou fausser les journaux.
- **Conditions et statut :** l'avis exige notamment une configuration de sous-réseau de confiance problématique. Le projet ne configure pas `trust proxy` et ne met pas en place de contrôle d'accès par IP. Aucun chemin d'exploitation n'est identifié ici.
- **Correction recommandée :** utiliser `proxy-addr` 2.0.8 minimum. Si un proxy est ajouté, définir précisément les adresses auxquelles le serveur fait confiance.
- **Source :** [GHSA-jqcg-44mw-7w3h — avis du mainteneur](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).

#### DEP-02 — Lecture de fichiers locaux dans la version Node de jsPDF

- **Version et fichier :** jsPDF 2.5.1, `public/index.html`, ligne 26.
- **Explication simple :** la version Node de la bibliothèque peut lire un fichier du serveur lorsque certaines fonctions reçoivent un chemin non contrôlé.
- **Risque :** insérer le contenu d'un fichier confidentiel dans un PDF et le divulguer.
- **Conditions et statut :** concerne la version Node et des fonctions comme `loadFile`, `addImage`, `html` ou `addFont`. Le projet utilise jsPDF dans le navigateur et n'appelle pas ces fonctions. Le scénario de lecture des fichiers du serveur est absent.
- **Correction recommandée :** le correctif propre à cet avis commence à jsPDF 4.0.0. Pour couvrir l'ensemble des avis recensés, viser au minimum 4.2.1, puis vérifier les exports.
- **Source :** [GHSA-f8cm-6447-x5h2 — avis du mainteneur](https://github.com/parallax/jsPDF/security/advisories/GHSA-f8cm-6447-x5h2).

#### DEP-03 — Injection HTML dans certaines fenêtres de sortie de jsPDF

- **Version et fichier :** jsPDF 2.5.1, `public/index.html`, ligne 26.
- **Explication simple :** certaines fonctions qui ouvrent un PDF dans une nouvelle fenêtre incorporent des options dans du HTML sans protection suffisante.
- **Risque :** exécuter un script dans la fenêtre ainsi créée si un attaquant contrôle ces options.
- **Conditions et statut :** concerne certains modes de `output()` et leurs options. Les exports du projet utilisent `save()` avec des noms fixes ; les modes vulnérables ne sont pas appelés.
- **Correction recommandée :** jsPDF 4.2.1 minimum et contrôle des options si ces fonctions sont ajoutées ultérieurement.
- **Source :** [GHSA-wfv2-pwc8-crg5 — avis du mainteneur](https://github.com/parallax/jsPDF/security/advisories/GHSA-wfv2-pwc8-crg5).

### 3.2. Gravité élevée

#### APP-01 — Accès public prévu en HTTP sans chiffrement

**Statut : risque conditionnel lié au déploiement.** Le serveur HTTP et l'écoute réseau sont constatés ; l'accessibilité publique réelle n'est pas vérifiée.

**Fichiers concernés :** `server.js`, lignes 6 et 21 ; `START_SITE.bat`, lignes 13 à 15 ; scripts de lancement pour la future configuration de déploiement.

Le serveur écoute sur toutes les interfaces et le script annonce une adresse Internet en `http://`. Aucun serveur HTTPS ou proxy HTTPS n'est configuré dans le dépôt.

Une connexion HTTP ne protège pas l'intégrité des fichiers reçus. Une personne capable d'intercepter le trafic pourrait remplacer la page ou le JavaScript. Le script remplacé pourrait ensuite lire les réponses sauvegardées dans le navigateur et les envoyer ailleurs.

Les réponses locales ne circulent normalement pas sur le réseau. Le risque décrit vient de la possibilité de modifier le code qui s'exécute dans le navigateur, et non d'un envoi normal des réponses par l'application.

**Corrections recommandées :**

1. Pour un usage local, écouter sur `127.0.0.1` et supprimer toute exposition Internet inutile.
2. Pour un usage public, publier le site derrière un service HTTPS avec certificat valide.
3. Rediriger les accès HTTP vers HTTPS et empêcher les accès externes directs au port Node.
4. Ajouter HSTS, un en-tête qui demande au navigateur de privilégier HTTPS, après validation du fonctionnement HTTPS et de son périmètre.

**Source :** [recommandations de sécurité Express, utilisation de TLS](https://expressjs.com/en/advanced/best-practice-security/).

#### Risque de déploiement — Utilisation possible d'une version de Node.js sans support

**Statut : point à vérifier ; aucune version vulnérable du moteur d'exécution n'est confirmée.**

**Fichiers concernés :** `README.md`, ligne 11 ; `package.json`, qui ne précise pas de plage de versions maintenues ; configuration Node/PM2 extérieure au projet.

La documentation autorise « Node.js 18 ou supérieur ». Au moment de l'audit, Node 18 et Node 20 sont sans support. Si l'hébergement utilise une version sans support, de nouveaux défauts de sécurité peuvent rester sans correctif pour cette branche.

**Correction recommandée :** vérifier la version déployée, utiliser une branche LTS maintenue comme Node 24 et préciser cette exigence dans les instructions de déploiement. Vérifier aussi la version et les mises à jour de PM2.

**Source :** [calendrier officiel des versions Node.js](https://nodejs.org/en/about/previous-releases).

#### DEP-04 à DEP-12 — Alertes élevées de dépendances

Les fichiers concernés sont `package-lock.json` pour `path-to-regexp` et `public/index.html`, ligne 26, pour jsPDF. Le code d'intégration de jsPDF se trouve dans `public/app.js`, dans les fonctions d'export PDF.

Chaque ligne décrit une vulnérabilité distincte. Les versions de correction indiquées couvrent l'avis de la ligne ; la mise à jour globale recommandée de jsPDF reste **4.2.1 minimum** pour les avis recensés.

| Identifiant | Bibliothèque et avis | Explication et risque | Conditions dans ce projet | Correctif de l'avis |
| --- | --- | --- | --- | --- |
| DEP-04 | `path-to-regexp` 0.1.12 — [GHSA-37ch-88jc-xwx2](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-37ch-88jc-xwx2) | Certaines routes produisent une expression régulière extrêmement lente, qui peut bloquer le serveur. | Nécessite notamment plusieurs paramètres dans un même segment de route. La route `/test` et le montage statique actuel ne présentent pas cette structure. | 0.1.13 minimum. |
| DEP-05 | jsPDF 2.5.1 — [GHSA-w532-jxjh-hjhj](https://github.com/parallax/jsPDF/security/advisories/GHSA-w532-jxjh-hjhj) | Une adresse d'image malveillante peut provoquer un traitement très long et bloquer l'exécution. | Les fonctions concernées, dont `addImage`, `html` et `addSvgAsImage`, ne sont pas utilisées. | 3.0.1 minimum. |
| DEP-06 | jsPDF 2.5.1 — [GHSA-8mvj-3j78-4qmw](https://github.com/parallax/jsPDF/security/advisories/GHSA-8mvj-3j78-4qmw) | Une image PNG malformée peut provoquer une boucle ou un traitement excessivement long. | Aucun import d'image vers jsPDF et aucun appel à `addImage` ou `html`. | 3.0.2 minimum. |
| DEP-07 | jsPDF 2.5.1 — [GHSA-pqxr-3g65-p328](https://github.com/parallax/jsPDF/security/advisories/GHSA-pqxr-3g65-p328) | Des valeurs de champs de formulaire PDF peuvent injecter des objets PDF et du JavaScript. | Aucun formulaire AcroForm n'est généré. | 4.1.0 minimum. |
| DEP-08 | jsPDF 2.5.1 — [GHSA-95fx-jjr5-f39c](https://github.com/parallax/jsPDF/security/advisories/GHSA-95fx-jjr5-f39c) | Des dimensions d'image BMP non contrôlées peuvent provoquer une consommation excessive de ressources. | Aucune image BMP n'est traitée par les exports. | 4.1.0 minimum. |
| DEP-09 | jsPDF 2.5.1 — [GHSA-9vjf-qc39-jprp](https://github.com/parallax/jsPDF/security/advisories/GHSA-9vjf-qc39-jprp) | Du texte fourni à `addJS` peut modifier la structure du PDF et y injecter des objets. | `addJS` n'est pas appelé. | 4.2.0 minimum. |
| DEP-10 | jsPDF 2.5.1 — [GHSA-67pg-wm7f-q7fj](https://github.com/parallax/jsPDF/security/advisories/GHSA-67pg-wm7f-q7fj) | Une image GIF avec des dimensions malveillantes peut épuiser les ressources. | Les exports ne traitent aucune image GIF. | 4.2.0 minimum. |
| DEP-11 | jsPDF 2.5.1 — [GHSA-p5xg-68wr-hm3m](https://github.com/parallax/jsPDF/security/advisories/GHSA-p5xg-68wr-hm3m) | Certains éléments de boutons radio PDF peuvent injecter des objets PDF et du JavaScript. | Aucun bouton radio AcroForm n'est généré. | 4.2.0 minimum. |
| DEP-12 | jsPDF 2.5.1 — [GHSA-7x6v-j9x4-qf24](https://github.com/parallax/jsPDF/security/advisories/GHSA-7x6v-j9x4-qf24) | Une couleur d'annotation de texte libre peut être interprétée comme une partie de la structure du PDF. | Les annotations de texte libre concernées ne sont pas utilisées. | 4.2.1 minimum. |

### 3.3. Gravité moyenne

#### APP-02 — Injection HTML depuis une sauvegarde locale altérée

**Statut : défaut constaté, exploitation conditionnelle.** Aucun point d'entrée distant permettant d'altérer directement cette sauvegarde n'a été identifié.

**Fichier concerné :** `public/app.js`, notamment lignes 303 à 315, 678, 702 à 707 et 849 à 856.

Le chargement de la sauvegarde vérifie son numéro de version, mais ne contrôle pas précisément les types et valeurs de ses champs. `Object.assign(state, rest)` copie ensuite les données sauvegardées dans l'état de l'application.

Lors de l'affichage des résultats, les scores et certains textes provenant de cet état sont insérés avec `innerHTML`. Cette propriété demande au navigateur d'interpréter une chaîne comme du HTML, et pas simplement de l'afficher comme du texte.

**Risques :** si la sauvegarde contient du HTML malveillant, l'affichage peut exécuter du JavaScript, modifier la page ou divulguer les données locales.

**Conditions :** une personne doit déjà pouvoir altérer le stockage de cette origine, par exemple par un accès local au navigateur ou par un script compromis. L'application ne possède aucun import de fichier ou API distante permettant de déposer ces valeurs. La gravité tient compte de cette limitation.

Le nom d'affichage est inséré avec `textContent` et n'est pas le point d'injection identifié. Les interpolations HTML des options du questionnaire utilisent actuellement des textes fixes définis dans le code.

**Corrections recommandées :**

- Construire les éléments affichés et placer leurs valeurs avec `textContent`.
- Accepter uniquement les champs attendus de la sauvegarde, après validation.
- Vérifier les identifiants de questions, les réponses autorisées, le mode et les bornes de l'index.
- Reconstruire les textes et les résultats depuis les questions et réponses validées, au lieu de faire confiance à un objet `result` sauvegardé.
- Contrôler que les scores sont des nombres finis et dans les bornes prévues si des scores sauvegardés sont conservés.

#### APP-03 — Bibliothèques externes sans vérification d'intégrité

**Statut : absence de protection constatée ; aucune compromission du CDN n'est établie.**

**Fichier concerné :** `public/index.html`, lignes 26 et 27.

jsPDF et Chart.js sont chargés depuis jsDelivr sans attribut `integrity`. Le navigateur ne compare donc pas les fichiers reçus avec une empreinte attendue définie par le projet.

**Risques :** un fichier externe altéré s'exécuterait avec les droits de la page et pourrait accéder à ses réponses sauvegardées. Une indisponibilité du CDN peut aussi empêcher certaines fonctions, notamment le graphique.

Les versions fixes et le chargement en HTTPS réduisent déjà certains risques, mais ne garantissent pas que les octets reçus correspondent à une copie précédemment vérifiée.

**Corrections recommandées :**

- Héberger des copies locales vérifiées des bibliothèques, ou ajouter une empreinte SRI à chaque script externe.
- En cas d'utilisation de SRI avec ces ressources externes, ajouter `crossorigin="anonymous"` et vérifier la compatibilité du CDN.
- Recalculer les empreintes à chaque mise à jour et maintenir un inventaire des bibliothèques du navigateur.
- Gérer clairement l'indisponibilité d'une bibliothèque dans l'interface.

**Source :** [documentation sur l'intégrité des sous-ressources, ou SRI](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity).

#### APP-04 — Absence de politique de sécurité du contenu sur les pages normales

**Statut : absence constatée dans le projet ; les en-têtes éventuellement ajoutés par un hébergement externe sont inconnus.**

**Fichiers concernés :** `server.js`, avant la distribution des fichiers ; `public/index.html` et `public/app.js` pour la compatibilité de la politique.

Aucune politique `Content-Security-Policy`, ou CSP, n'est définie. Une CSP indique au navigateur quelles sources de scripts, contenus et connexions sont autorisées.

**Risques :** si une injection survient, le navigateur dispose de moins de restrictions pour empêcher l'exécution d'un script ou l'envoi de données vers une destination extérieure. L'absence de CSP ne constitue pas, à elle seule, une injection exploitable.

**Corrections recommandées :** définir une politique adaptée aux ressources réellement nécessaires, en particulier une restriction des scripts, `object-src 'none'`, `base-uri 'none'` et une limitation des connexions sortantes. Les styles intégrés à la page et les modifications de style effectuées par le code devront être pris en compte afin de conserver une interface fonctionnelle.

Une politique autorisant le CDN ne protège pas automatiquement contre une altération d'un script autorisé : elle doit être complétée par SRI ou par un hébergement local vérifié.

#### APP-05 — Conservation automatique et durable des réponses personnelles

**Statut : comportement constaté ; risque plus important sur un ordinateur partagé.**

**Fichiers concernés :** `public/app.js`, lignes 282 à 315, 422 à 435 et 849 à 856 ; `public/index.html`, champ du nom et présentation de la sauvegarde.

L'application sauvegarde automatiquement le nom, les choix et le profil dans `localStorage`, sans expiration définie. Un résultat terminé peut réapparaître à l'ouverture du site. La page n'explique pas clairement cette conservation à l'utilisateur.

**Risques :** une autre personne utilisant le même profil de navigateur peut retrouver les réponses. Les scripts exécutés dans cette origine peuvent également les lire. Les fichiers exportés contiennent des informations personnelles lorsque le nom est renseigné.

Le stockage local limite la collecte côté serveur, mais ne fournit pas une séparation entre plusieurs personnes partageant le même navigateur.

**Corrections recommandées :**

- Informer simplement l'utilisateur de l'emplacement et de la durée de conservation.
- Proposer une sauvegarde facultative ou un mode temporaire utilisant `sessionStorage`.
- Ajouter une durée d'expiration si une sauvegarde durable est conservée.
- Permettre un effacement facilement identifiable et rappeler que les exports téléchargés restent sur l'appareil.
- Encourager l'utilisation d'un pseudonyme ou rendre le nom facultatif.

Un chiffrement dont la clé est accessible au même JavaScript ne protège pas les réponses contre un script compromis dans la page. La réduction des données conservées et la sécurisation des scripts sont prioritaires.

#### APP-06 — Protections contre la saturation non définies dans le projet

**Statut : risque conditionnel de déploiement, sans mesure de résistance ni attaque reproduite.**

**Fichiers concernés :** `server.js` et scripts PM2 ; protections réseau éventuellement extérieures au dépôt.

Le serveur ne définit aucune limitation de débit applicative, limite explicite de connexions ou configuration propre des délais d'attente. Il bénéficie néanmoins des comportements par défaut de Node.js : l'absence de réglage dans le projet ne signifie pas une absence totale de limites.

**Risques :** si le processus Node est directement exposé, un volume important de requêtes ou de connexions peut occuper ses ressources et rendre le site indisponible. PM2 peut gérer le processus, mais son utilisation seule ne constitue pas une protection contre ces attaques.

**Corrections recommandées :** pour un site public, servir les fichiers derrière un hébergement ou proxy adapté, configurer des limites de débit, de connexions et de délais d'attente, définir des limites de ressources et surveiller les erreurs et la disponibilité. Les réglages doivent rester proportionnés à ce site statique.

#### DEP-13 à DEP-16 — Alertes moyennes de dépendances

Les fichiers concernés sont `package-lock.json`, entrée `qs` à la ligne 581, et `public/index.html`, ligne 26, pour jsPDF.

| Identifiant | Bibliothèque et avis | Explication et risque | Conditions dans ce projet | Correctif de l'avis |
| --- | --- | --- | --- | --- |
| DEP-13 | `qs` 6.14.1 — [GHSA-4mjr-xmp4-gh2g](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g) | Certains objets contrôlés par un attaquant font échouer `stringify` avec une exception, pouvant interrompre un traitement. | Le projet n'effectue pas de conversion `qs.parse` puis `qs.stringify` sur des données reçues. | 6.16.0 minimum. |
| DEP-14 | `qs` 6.14.1 — [GHSA-q8mj-m7cp-5q26](https://github.com/ljharb/qs/security/advisories/GHSA-q8mj-m7cp-5q26) | Une combinaison d'options et de tableaux contenant des valeurs nulles provoque une exception lors de la sérialisation. | Aucun appel à `qs.stringify` avec ces options. | 6.15.2 minimum ; viser 6.16.0 pour l'ensemble des avis recensés de `qs`. |
| DEP-15 | jsPDF 2.5.1 — [GHSA-vm32-vv63-w422](https://github.com/parallax/jsPDF/security/advisories/GHSA-vm32-vv63-w422) | Des métadonnées non contrôlées peuvent ajouter de fausses informations au PDF et compromettre leur intégrité. | La fonction `addMetadata` n'est pas utilisée. | 4.1.0 minimum. |
| DEP-16 | jsPDF 2.5.1 — [GHSA-cjw8-79x6-5cj4](https://github.com/parallax/jsPDF/security/advisories/GHSA-cjw8-79x6-5cj4) | Un état partagé dans `addJS` peut mélanger le contenu de documents dans certains traitements et divulguer du contenu. | Aucun appel à `addJS` et aucune génération PDF sur le serveur. | 4.0.1 minimum selon le champ des versions corrigées de l'avis. |

### 3.4. Gravité faible

#### APP-07 — Une sauvegarde invalide peut bloquer l'interface

**Statut : défaut de robustesse constaté par lecture du code, sans test d'exécution.**

**Fichier concerné :** `public/app.js`, notamment `loadState`, `computeScores`, `resume`, `renderResult` et `init`.

Une sauvegarde possédant le bon numéro de version peut néanmoins contenir des champs manquants, des identifiants inconnus ou des types incorrects. Les fonctions qui utilisent ces données peuvent alors provoquer une exception.

Dans `init`, les résultats peuvent être affichés avant que les gestionnaires des boutons soient enregistrés. Si l'affichage échoue, le bouton de réinitialisation peut donc rester inutilisable. Certaines opérations sur `localStorage`, dont la lecture initiale et les écritures, ne sont pas protégées contre les erreurs d'accès ou de quota.

**Risques :** perte de progression, reprise impossible et interface inutilisable pour ce profil de navigateur. Une valeur très volumineuse peut également alourdir l'affichage ou un export. Aucun mécanisme de blocage du serveur par cette sauvegarde locale n'est identifié.

**Corrections recommandées :** valider la structure et la taille des données, gérer les erreurs de stockage, rejeter les sauvegardes incohérentes et assurer le fonctionnement de la réinitialisation même si la reprise échoue. Recalculer le résultat depuis des réponses validées réduit aussi le risque de falsification locale du profil.

#### APP-08 — Divulgation technique possible en mode développement

**Statut : risque conditionnel pour les erreurs ; configuration par défaut non durcie pour `X-Powered-By`.**

**Fichiers concernés :** `server.js`, `START_SITE.bat` et `START_SITE_AUTO.bat` ; environnement PM2 extérieur au projet.

Les scripts de lancement ne définissent pas `NODE_ENV=production`. Si cette variable n'est pas définie ailleurs, Express utilise le mode développement. Son gestionnaire d'erreurs peut alors retourner une trace d'erreur contenant des chemins de fichiers et des détails techniques.

Le projet ne désactive pas non plus `X-Powered-By`, un en-tête qui annonce l'utilisation d'Express.

**Risques :** faciliter la reconnaissance de l'environnement par un attaquant. Ces informations seules ne donnent pas accès aux fichiers ni au serveur.

**Corrections recommandées :** définir explicitement le mode production, ajouter un traitement d'erreur retournant un message générique au visiteur, conserver les détails dans des journaux adaptés et désactiver `X-Powered-By`. Le mode production ne remplace pas une protection contre les erreurs de logique applicative.

**Sources :** [configuration par défaut d'Express 4.22.1](https://github.com/expressjs/express/blob/v4.22.1/lib/application.js), [gestionnaire finalhandler 1.3.2](https://raw.githubusercontent.com/pillarjs/finalhandler/v1.3.2/index.js).

#### APP-09 — Intégration dans une page tierce non interdite

**Statut : absence de protection constatée dans le dépôt ; en-têtes du déploiement réel inconnus.**

**Fichiers concernés :** `server.js` pour les en-têtes ; `public/index.html` pour la page pouvant être intégrée.

Aucun en-tête interdisant l'affichage normal du site dans une fenêtre intégrée, ou `iframe`, n'est configuré.

**Risques :** une page tierce pourrait placer l'interface sous des éléments trompeurs et provoquer des clics involontaires, par exemple sur la réinitialisation. Cette technique est appelée détournement de clics. L'impact reste limité ici : il n'existe ni paiement, ni action administrative, ni compte utilisateur. L'intégration ne permet pas à elle seule de lire les réponses à travers la séparation des origines du navigateur.

**Correction recommandée :** ajouter `frame-ancestors 'none'` à la CSP si aucune intégration n'est prévue ; utiliser éventuellement `X-Frame-Options: DENY` en complément. Si une intégration est souhaitée, autoriser explicitement les seules origines nécessaires.

#### DEP-17 et DEP-18 — Alertes faibles de dépendances

**Fichier concerné :** `package-lock.json`, entrées `qs` à la ligne 581 et `body-parser` à la ligne 34.

| Identifiant | Bibliothèque et avis | Explication et risque | Conditions dans ce projet | Correctif de l'avis |
| --- | --- | --- | --- | --- |
| DEP-17 | `qs` 6.14.1 — [GHSA-w7fw-mjwx-w883](https://github.com/ljharb/qs/security/advisories/GHSA-w7fw-mjwx-w883) | Le traitement de tableaux séparés par des virgules peut contourner une limite et consommer trop de mémoire. | L'option `comma: true` n'est pas activée dans le projet. | 6.14.2 minimum ; viser 6.16.0 pour l'ensemble des avis recensés de `qs`. |
| DEP-18 | `body-parser` 1.20.4 — [GHSA-v422-hmwv-36x6](https://github.com/expressjs/body-parser/security/advisories/GHSA-v422-hmwv-36x6) | Une limite de taille invalide peut désactiver silencieusement le contrôle de taille des corps de requête. | Aucun parseur de corps de requête n'est activé et aucune option `limit` n'est fournie. | 1.20.6 minimum. |

### 3.5. Bilan des dépendances

| Bibliothèque | Version déclarée ou verrouillée | Nombre d'avis retournés | Objectif minimal couvrant les avis recensés |
| --- | --- | --- | --- |
| `proxy-addr` | 2.0.7 | 1 critique | 2.0.8 |
| `path-to-regexp` | 0.1.12 | 1 élevé | 0.1.13 |
| `qs` | 6.14.1 | 2 moyens et 1 faible | 6.16.0 |
| `body-parser` | 1.20.4 | 1 faible | 1.20.6 |
| jsPDF | 2.5.1, chargé par CDN | 2 critiques, 8 élevés et 2 moyens | 4.2.1 |

Ces objectifs sont des versions minimales pour les avis recensés, pas une promesse d'absence de nouvelles vulnérabilités. La compatibilité et les avis devront être revérifiés au moment de la correction.

**Différence de classement entre les sources :** le registre npm classe DEP-09 (`addJS`, GHSA-9vjf-qc39-jprp) en gravité élevée, alors que la page du mainteneur l'affiche comme critique. Le classement et les décomptes ci-dessus suivent le registre consulté. Cette différence doit être conservée à l'esprit lors de la maintenance ; elle ne change pas le constat que `addJS` n'est pas utilisé par le projet.

Aucun avis n'a été retourné pour Chart.js 4.4.1 ni pour les autres versions interrogées. Cela ne prouve pas qu'elles sont exemptes de tout défaut.

Express est verrouillé en version 4.22.1. Les quatre bibliothèques serveur signalées font partie de son arbre de dépendances. Il faudra mettre à jour cet arbre et le fichier de verrouillage, puis vérifier les versions réellement résolues. Modifier uniquement la plage de version d'Express dans `package.json` ne garantit pas que toutes ces bibliothèques soient corrigées. Il n'est pas nécessaire de migrer vers une nouvelle version majeure d'Express sans évaluation préalable.

La présence de fonctions vulnérables inutilisées reste une dette de maintenance : une évolution de l'application peut rendre un avis applicable. Aucun contournement d'authentification, exécution de commande serveur ou accès à des fichiers confidentiels n'a été identifié dans les routes actuelles.

## 4. Synthèse : explications, fichiers, risques et corrections

Cette synthèse réunit les constats applicatifs. Les 18 avis de dépendances sont détaillés et classés dans la section précédente.

| Référence | Gravité dans le contexte du projet | Fichiers concernés | Risque principal | Correction recommandée |
| --- | --- | --- | --- | --- |
| APP-01 | Élevée si accès public HTTP | `server.js`, `START_SITE.bat` | Remplacement du code reçu par le navigateur et accès aux réponses locales | HTTPS, restriction du port Node et de l'écoute réseau |
| Version de Node | Potentiellement élevée, non confirmée | `README.md`, `package.json`, environnement externe | Utilisation d'un moteur qui ne reçoit plus de correctifs | Vérifier la version et utiliser une LTS maintenue |
| APP-02 | Moyenne, conditionnelle | `public/app.js` | Exécution de HTML/JavaScript provenant d'une sauvegarde altérée | `textContent`, validation et reconstruction des résultats |
| APP-03 | Moyenne | `public/index.html` | Exécution d'une bibliothèque externe altérée | Copies locales vérifiées ou SRI |
| APP-04 | Moyenne, protection complémentaire absente | `server.js`, `public/index.html`, `public/app.js` | Impact accru d'une injection | CSP adaptée |
| APP-05 | Moyenne sur un navigateur partagé | `public/app.js`, `public/index.html` | Consultation ultérieure des réponses par une autre personne | Information, sauvegarde facultative, expiration ou stockage temporaire |
| APP-06 | Moyenne si exposition directe, non mesurée | `server.js`, scripts et infrastructure externe | Indisponibilité sous trafic abusif | Limites réseau, proxy adapté et supervision |
| APP-07 | Faible | `public/app.js` | Blocage local de l'interface et perte de progression | Validation, gestion des erreurs et réinitialisation fiable |
| APP-08 | Faible, en partie conditionnelle | `server.js`, scripts PM2 | Divulgation de détails techniques | Mode production, erreurs génériques, désactivation de `X-Powered-By` |
| APP-09 | Faible | `server.js`, `public/index.html` | Clics involontaires via une page tierce | Restriction de l'intégration avec `frame-ancestors` |

## 5. Protections déjà présentes dans le projet

### 5.1. Surface serveur réduite

- Le serveur publie uniquement le dossier `public`, et non la racine du projet. Les fichiers de configuration, scripts Windows et fichiers Git ne sont donc pas directement publiés par ce montage statique.
- La seule route explicite est `GET /test`, qui retourne un texte fixe.
- Aucune API de modification, aucun téléversement, aucune base de données et aucune commande système pilotée par une requête ne sont présents.
- Aucune session ou authentification n'est utilisée. L'absence de protection CSRF n'est donc pas une faille identifiée dans cette application sans action serveur authentifiée.
- Les fichiers publics examinés ne contiennent pas de secret identifié et ne sont pas des liens symboliques vers des fichiers extérieurs.

Cette simplicité limite les possibilités d'injection SQL, de contournement de comptes, d'accès à des objets d'autres utilisateurs ou d'exécution de commandes côté serveur. Elle ne protège pas contre tous les défauts d'Express, de Node ou du déploiement.

### 5.2. Traitement des données dans le navigateur

- Les réponses restent dans le navigateur dans le code applicatif examiné.
- Le nom d'affichage, le titre du profil, sa description et les étiquettes sont affichés avec `textContent`.
- Le champ du nom est limité à 32 caractères dans le formulaire. Il s'agit d'une limite d'interface, pas d'une validation de toutes les données sauvegardées.
- Les questions et leurs options sont définies dans le code. Aucun contenu de questionnaire envoyé par un autre utilisateur n'est accepté.
- Les scores calculés sont bornés entre 0 et 100. Cette borne ne s'applique pas automatiquement à un résultat arbitraire chargé depuis le stockage.
- Le numéro de schéma permet de rejeter une sauvegarde incompatible avec le format attendu, même si la validation de son contenu reste insuffisante.
- Une fonction de réinitialisation supprime la sauvegarde locale lorsque l'interface fonctionne.
- Les téléchargements JSON utilisent le type `application/json`, des noms fixes et des URL temporaires libérées après usage.

### 5.3. Dépendances et dépôt

- Toutes les 68 entrées de paquets du verrouillage contiennent une empreinte d'intégrité.
- Les URL de téléchargement déclarées dans ce fichier utilisent le registre npm en HTTPS.
- Aucun indicateur `hasInstallScript` n'a été trouvé dans ces entrées. Cela ne constitue pas une certification de tous les contenus des paquets.
- Les deux bibliothèques CDN sont demandées avec des versions fixes et en HTTPS.
- `.gitignore` exclut `node_modules` et `.env`. Aucun fichier `.env` n'était présent dans la copie examinée.
- Aucun secret n'a été relevé par la recherche ciblée dans les fichiers et l'historique disponibles.

## 6. Protections supplémentaires à mettre en place

Les protections suivantes sont recommandées, sans avoir été appliquées :

### 6.1. Publication et réseau

- Choisir explicitement le périmètre du site : local, réseau privé ou Internet.
- Utiliser HTTPS pour toute publication publique et protéger le certificat.
- Restreindre le port Node et les règles entrantes au besoin réel.
- Utiliser un compte de service aux droits limités pour Node et PM2, après vérification du déploiement actuel.
- Configurer les limites de connexions, délais d'attente et ressources dans le service d'hébergement ou le proxy.

### 6.2. Navigateur et affichage

- Éliminer les insertions de données sauvegardées avec `innerHTML`.
- Mettre en place une CSP qui autorise seulement les ressources nécessaires.
- Utiliser SRI pour les scripts externes, ou les servir localement après vérification.
- Ajouter `X-Content-Type-Options: nosniff` sur les réponses normales pour empêcher certaines interprétations de fichiers sous un type inattendu.
- Définir une politique de référent adaptée, par exemple `strict-origin-when-cross-origin`, pour limiter les informations d'adresse transmises lors de navigation vers d'autres sites.
- Restreindre l'intégration dans des pages tierces si elle n'est pas nécessaire.

Les en-têtes peuvent être ajoutés dans Express ou dans le proxy, mais leur présence devra être contrôlée sur les réponses réellement reçues. Aucun outil particulier, comme une bibliothèque de gestion d'en-têtes, n'est obligatoire : c'est le résultat effectif qui compte.

### 6.3. Sauvegarde et confidentialité

- Valider explicitement les champs acceptés et ignorer les champs supplémentaires.
- Limiter la taille de la sauvegarde et vérifier la cohérence des réponses.
- Prévoir un comportement sûr en cas de stockage indisponible ou de données corrompues.
- Informer l'utilisateur de la sauvegarde et lui permettre de choisir sa conservation.
- Éviter les données personnelles inutiles et prévoir leur effacement.

### 6.4. Maintenance et suivi

- Mettre à jour les bibliothèques affectées, y compris celles chargées hors de npm.
- Utiliser une version Node.js maintenue et vérifier les mises à jour de PM2.
- Configurer le mode production et des messages d'erreur publics génériques.
- Surveiller les erreurs et l'indisponibilité, sans ajouter les réponses ou profils personnels aux journaux.
- Refaire la vérification des avis lors des mises à jour et avant une publication importante.
- Corriger la documentation : elle mentionne actuellement `index.js` et le port 3000, alors que le serveur réel est `server.js` sur le port 8000. Ce décalage est un problème de maintenance, pas une vulnérabilité autonome.

L'ajout d'une authentification, d'une base de données ou d'un mécanisme CSRF n'est pas nécessaire pour corriger les constats actuels. Si ces fonctionnalités sont introduites, elles devront faire l'objet d'un nouvel examen.

## 7. Plan de correction classé par priorité

> Ce plan est une proposition. Aucune de ses actions n'a été exécutée. Toute correction ou installation nécessite une autorisation préalable de l'utilisateur.

| Priorité | Actions | Raison | Vérification attendue après autorisation |
| --- | --- | --- | --- |
| **P0 — Avant de maintenir ou ouvrir un accès public** | Vérifier la publication réelle, le pare-feu, les ports et HTTPS ; restreindre l'écoute si le site est local ; vérifier la version de Node | Éviter une distribution de code altérable en transit et un moteur sans support | Vérifier les réponses du site, le certificat et l'impossibilité de contourner le proxy par le port Node |
| **P1 — Sécuriser les données affichées** | Remplacer le rendu HTML des valeurs sauvegardées ; valider la sauvegarde ; reconstruire les résultats ; assurer la réinitialisation | Traiter APP-02 et APP-07 à leur source | Tester un parcours normal, une reprise valide, une sauvegarde incohérente et des valeurs contenant des caractères HTML, dans un environnement de test |
| **P1 — Mettre à jour les dépendances** | Actualiser l'arbre Express et le verrouillage ; mettre à jour jsPDF ; vérifier Chart.js et PM2 | Retirer les versions affectées et éviter qu'une évolution rende une alerte exploitable | Contrôler les versions effectivement installées, consulter à nouveau les avis et vérifier les exports PDF/JSON et le graphique |
| **P2 — Ajouter les protections du navigateur** | SRI ou ressources locales ; CSP ; `nosniff` ; restriction des fenêtres intégrées et politique de référent | Limiter l'impact d'une injection et les risques liés aux ressources externes | Inspecter les en-têtes réels et vérifier que le questionnaire, le graphique et les téléchargements fonctionnent |
| **P2 — Améliorer la confidentialité locale** | Expliquer la sauvegarde ; proposer un choix de conservation ; ajouter expiration ou mode temporaire | Réduire l'exposition sur un ordinateur partagé | Vérifier le comportement après fermeture, reprise, expiration et effacement, selon le mode choisi |
| **P2 — Durcir l'exploitation publique** | Mode production, erreurs génériques, limites de ressources, débit et connexions ; supervision | Réduire la divulgation technique et le risque d'indisponibilité | Vérifier des erreurs ordinaires et les réglages d'infrastructure ; réserver tout test de charge à un environnement et un périmètre autorisés |
| **P3 — Fiabiliser la maintenance** | Actualiser le README ; documenter Node/PM2 et le déploiement ; prévoir une vérification régulière des dépendances | Éviter les écarts entre le dépôt et l'exploitation réelle | Vérifier qu'une procédure documentée permet un lancement et une publication cohérents |

Les protections complémentaires ne doivent pas remplacer les corrections de fond. Une CSP ne justifie pas de conserver le rendu dangereux de données ; SRI ne corrige pas une vulnérabilité interne à une bibliothèque ; PM2 ne remplace pas les protections réseau.

## 8. Conclusion sur le niveau de sécurité et les risques restants

L'architecture actuelle présente une surface d'attaque serveur réduite : elle distribue essentiellement des fichiers statiques et ne traite pas de comptes ou de réponses côté serveur. Ces choix limitent plusieurs familles de vulnérabilités courantes.

**Le projet nécessite néanmoins des corrections et des vérifications avant que sa sécurité en publication publique puisse être considérée comme suffisante.** Le risque prioritaire est l'accès HTTP public annoncé par le script de démarrage. Si cet accès est réellement utilisé, le code reçu par un visiteur peut être altéré par un intermédiaire réseau.

Le principal défaut du code applicatif est la confiance excessive accordée aux résultats sauvegardés, qui sont en partie interprétés comme du HTML. Son exploitation exige de pouvoir altérer la sauvegarde locale ; aucun chemin direct d'injection par un visiteur distant n'a été identifié. La conservation durable des réponses mérite aussi une amélioration, particulièrement sur un appareil partagé.

Les 18 avis de dépendances doivent être traités, mais leurs fonctions ou configurations de déclenchement ne sont pas présentes dans les parcours examinés. Ils constituent actuellement une dette de maintenance plutôt que 18 compromissions confirmées du site. Les versions minimales proposées couvrent uniquement les avis recensés à la date de l'audit.

**Aucune faille critique exploitable à distance n'a été démontrée par cette analyse statique. Aucune garantie d'absence de vulnérabilités ne peut cependant être donnée**, notamment parce que le déploiement réel, les paquets installés et le comportement à l'exécution n'ont pas été vérifiés.

Après les corrections, les risques restants devront être réévalués sur un environnement de test puis sur la configuration réellement publiée. Les points essentiels seront HTTPS, les en-têtes de sécurité, les versions installées, la reprise d'une sauvegarde, les exports et la restriction des accès réseau.

Ce document suit le format demandé pour les futurs rapports : présentation, périmètre et limites, constats classés, détails et corrections, protections existantes, protections supplémentaires, priorités et conclusion. Les constats de ce rapport ne doivent pas être repris automatiquement dans un nouvel audit sans nouvelle vérification.
