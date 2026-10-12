# Dilemmes moraux

Questionnaire éthique de 30 questions, ou 12 en mode rapide, avec scores, graphique, reprise de progression et exports PDF/JSON. Les réponses sont traitées dans le navigateur ; aucune base de données ni API de collecte des réponses n'est utilisée.

## Prérequis et installation locale

Utiliser une version maintenue de Node.js : **Node 24 LTS recommandé**. Les branches 22, 24 et 26 sont déclarées compatibles ; les tests de cette correction ont été exécutés sous Node 24.21.0. Node 18 et 20 ne sont plus recommandés car leur support est terminé.

Depuis la racine du projet :

```powershell
npm ci --ignore-scripts
npm run vendor
npm start
```

L'installation utilise `package-lock.json`. `--ignore-scripts` empêche l'exécution des scripts d'installation de paquets tiers ; la deuxième commande exécute explicitement le script du projet qui prépare les bibliothèques locales. Une installation normale sans cette option lance également cette préparation via `postinstall`.

Ouvrir **http://localhost:8000** ou **http://127.0.0.1:8000**. Le serveur écoute sur `127.0.0.1`, sans exposition automatique sur le réseau local ou Internet. Aucun certificat n'est nécessaire pour ce fonctionnement local. Une modification des sources du serveur nécessite son redémarrage.

Les fichiers vérifiés de jsPDF et Chart.js, leurs licences et leurs empreintes sont copiés dans `public/vendor`. Ils sont versionnables et peuvent être distribués sans accès à un CDN. Lors d'une mise à jour de ces deux bibliothèques, adapter les versions et noms de fichiers dans `scripts/prepare-vendor.mjs`, puis relancer la préparation et les tests.

## Données du navigateur

- Le nom reste facultatif ; un pseudonyme est préférable sur un appareil partagé.
- Par défaut, la progression est enregistrée dans ce navigateur pour conserver la fonction de reprise.
- Décocher « Conserver ma progression dans ce navigateur » utilise le stockage de l'onglet. Le transfert préserve les réponses si le stockage de destination fonctionne.
- La reprise expire 30 jours après la dernière sauvegarde. Une sauvegarde expirée est rejetée et effacée lors de la prochaine ouverture ; elle n'est pas effacée en arrière-plan pendant que le site est fermé.
- La restauration d'un onglet par le navigateur peut restaurer sa session. Utiliser **Réinitialiser** avant de quitter un appareil partagé.
- Les anciennes sauvegardes valides sont migrées. Les résultats sont recalculés à partir des réponses, sans réutiliser de HTML, de scores ou de profils sauvegardés.
- Si le navigateur bloque le stockage, le questionnaire et les exports restent utilisables, avec un message indiquant que la progression peut être perdue.
- La réinitialisation n'efface que la progression de cette application. Elle ne supprime pas les exports déjà téléchargés.

Les données locales ne sont pas chiffrées. Une personne ayant accès au même profil de navigateur, ou un script compromis exécuté dans l'origine du site, peut y accéder. Le résultat n'est pas une preuve infalsifiable d'identité ou de réponses.

Un changement d'origine, par exemple de `http://localhost:8000` à un domaine HTTPS, crée un espace de stockage distinct. Les sauvegardes locales ne sont pas automatiquement transférées vers le futur domaine public ; les exports permettent de conserver une copie des résultats.

## Configuration du serveur

| Variable | Valeur locale par défaut | Usage |
| --- | --- | --- |
| `NODE_ENV` | Mode développement | `production` active les exigences HTTPS et HSTS |
| `HOST` | `127.0.0.1` | En production, uniquement `127.0.0.1` ou `::1` |
| `PORT` | `8000` | Port entre 1 et 65535 |
| `TRUST_PROXY` | `false` | En production, `loopback` pour un proxy sur la même machine ; les autres valeurs sont refusées |
| `PUBLIC_ORIGIN` | Non nécessaire | En production, origine HTTPS exacte, sans chemin ni identifiants |
| `RATE_LIMIT_MAX` | `180` | Nombre maximal de requêtes par minute et par IP ou sous-réseau IPv6 ; valeur entre 1 et 10000 |

Le fichier `.env.example` est un exemple. `npm start` ne le charge pas automatiquement. Pour utiliser un fichier `.env` choisi et créé par l'utilisateur :

```powershell
node --env-file=.env server.js
```

Le serveur accepte seulement GET et HEAD, borne la longueur des adresses, n'analyse pas les corps ou les paramètres de requête inutiles et ne publie que `public`. Les délais d'attente sont limités, les erreurs retournées au navigateur sont génériques et les en-têtes de sécurité sont activés.

La CSP autorise les scripts locaux et interdit les scripts intégrés et les connexions de type `fetch`/XHR. Les styles d'attributs restent autorisés pour préserver la présentation et les animations existantes ; aucun assouplissement équivalent n'est accordé aux scripts.

## Lancement avec PM2, facultatif

Les scripts `START_SITE.bat` et `START_SITE_AUTO.bat` utilisent désormais `ecosystem.config.cjs`, en mode local. `STOP_SITE.bat` conserve sa fonction d'arrêt. Ils nécessitent une installation de PM2 disponible dans votre environnement. Aucune installation globale ni aucun service PM2 n'a été modifié pendant les corrections.

La version externe de PM2 doit être vérifiée et maintenue avant utilisation. La configuration préparée utilise un processus unique et un seuil de redémarrage mémoire de 256 Mo. Sa syntaxe Node a été vérifiée, mais les scripts Windows et le cycle de vie réel PM2 n'ont pas pu être testés ici, car PM2 n'est pas installé.

## Préparation d'une publication HTTPS — non activée

**Aucun site n'a été publié. Aucun réglage réseau, routeur, pare-feu, DNS ou système n'a été appliqué.**

L'architecture préparée prévoit un proxy HTTPS, par exemple Caddy, et Node sur la même machine. Le proxy reçoit les connexions publiques et les transmet au port local 8000. Le fichier [deployment/Caddyfile.example](deployment/Caddyfile.example) est un modèle à adapter et à valider ; il n'a pas été exécuté ni validé par Caddy dans cet environnement.

Après choix du domaine et autorisation des opérations de déploiement, un fichier `.env.production` peut contenir :

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8000
TRUST_PROXY=loopback
PUBLIC_ORIGIN=https://votre-domaine.example
RATE_LIMIT_MAX=180
```

Le nom d'exemple doit être remplacé par le véritable domaine. Le proxy utilise ce même nom comme `SITE_DOMAIN`. Son modèle écrase les en-têtes de protocole, d'hôte et d'adresse IP provenant du visiteur.

Le serveur Node préparé peut alors être lancé avec `node --env-file=.env.production server.js`. Si PM2 est retenu, utiliser l'environnement `production` de `ecosystem.config.cjs` et transmettre `PUBLIC_ORIGIN` au processus PM2. Ne pas lancer les scripts locaux pour démarrer une instance de production.

Le mode production refuse de démarrer sans origine HTTPS et proxy local explicitement configurés. Il redirige les requêtes HTTP reconnues vers l'origine configurée et ajoute HSTS. La confiance accordée aux en-têtes du proxy exige que celui-ci les écrase correctement et que le port Node reste privé.

Avant publication, il reste à :

1. Choisir et configurer le domaine et l'hébergement, avec l'autorisation de l'utilisateur.
2. Installer/configurer le proxy, obtenir un certificat et valider le modèle de configuration.
3. Vérifier les règles réseau pour empêcher tout accès externe direct au port Node.
4. Exécuter Node et le proxy avec des droits limités et vérifier leur maintenance.
5. Contrôler les certificats, redirections, en-têtes et adresses IP réellement observés.
6. Prévoir la supervision et une protection de l'hébergement contre les attaques volumétriques.

La limitation de requêtes est conservée en mémoire, par processus, et se réinitialise au redémarrage. Elle ne remplace pas une protection contre le déni de service distribué. Si plusieurs instances sont ajoutées, prévoir un stockage commun ou une limitation dans l'infrastructure.

Références : [proxy Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [limite de corps Caddy](https://caddyserver.com/docs/caddyfile/directives/request_body), [configuration PM2](https://pm2.keymetrics.io/docs/usage/application-declaration/).

## Tests

```powershell
npm test
npm run test:e2e
npm run check:security
```

- `npm test` vérifie les routes, en-têtes, erreurs, limites, simulation du proxy HTTPS, sauvegardes, migration et scores de référence.
- `npm run test:e2e` utilise un vrai navigateur avec un profil isolé et un serveur temporaire sur `127.0.0.1:18080`. Il vérifie les parcours complets, le graphique, les quatre exports, la reprise, le stockage refusé et la CSP effective.
- Sur Windows avec Edge à l'emplacement habituel, ce navigateur déjà installé est utilisé sans fenêtre visible. Sinon, un navigateur compatible Playwright doit être disponible ; son installation éventuelle doit être autorisée dans l'environnement concerné.
- `npm run check:security` nécessite un accès réseau au registre npm et vérifie également les dépendances de développement.

La copie portable de Node utilisée pour cette intervention se trouve éventuellement dans `.tools`, qui est exclu de Git. Elle sert uniquement à l'environnement de travail ; elle n'est pas une installation système ni un composant à publier.

Les résultats et limites de validation figurent dans [RAPPORT_CORRECTIONS_SECURITE.md](RAPPORT_CORRECTIONS_SECURITE.md). Le suivi de l'audit initial se trouve dans [RAPPORT_SECURITE.md](RAPPORT_SECURITE.md).

## Licence

Projet personnel à but éducatif. Les bibliothèques distribuées conservent leurs licences dans `public/vendor`.
