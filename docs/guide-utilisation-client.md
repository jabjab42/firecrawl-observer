# 🕵️ Guide d'Utilisation : Kabuki Observer

> [!IMPORTANT]
> **Configuration Express (Demandes Clientes)**
> 
> **Utiliser un modèle Mistral :**
> Pour configurer l'IA Mistral, allez dans **Account** > **Settings** > **AI Analysis** :
> - Entrez votre **Clé API Mistral**.
> - Indiquez le **modèle** souhaité (ex: `mistral-small-latest`).
> - Dans **Base URL (Optional)**, renseignez : `https://api.mistral.ai/v1`
> 
> **Changer les règles de GO / NO GO :**
> Pour modifier les critères de sélection intelligente, allez dans :
> - **Account** > **Settings** > **Go/No Go Rules (Deep Analysis)**
> - *Note : L'outil n'envoie une alerte (Webhook/Email) que si au moins une opportunité a un score de **50/100 ou plus**. Seules les opportunités validées (au dessus de 50) sont affichées dans l'alerte.*

---

Bienvenue sur votre outil de surveillance de sites internet ! Ce guide vous aidera à prendre en main **Kabuki Observer**, un assistant intelligent qui surveille vos sites préférés à votre place et vous alerte uniquement quand quelque chose d'important change.

---

## 1. Introduction : C'est quoi Kabuki Observer ?
Imaginez un assistant qui visite vos sites préférés toutes les heures et qui vous envoie un message si (et seulement si) une information importante a été mise à jour. C'est exactement ce que fait Kabuki Observer. Grâce à l'Intelligence Artificielle (IA), il fait la différence entre un changement mineur (comme une date qui change) et une vraie nouveauté.

---

## 2. Premiers Pas
### Connexion
Connectez-vous à votre interface avec votre email et votre mot de passe. Vous arriverez directement sur votre **Tableau de Bord**.

### Le Tableau de Bord
C'est ici que vous voyez tous les sites que vous surveillez actuellement.
- **Statut** : Indique si le site est surveillé ou s'il y a un souci.
- **Dernière vérification** : Quand l'outil est passé pour la dernière fois.
- **Dernier changement** : Résumé du dernier changement détecté par l'IA.

---

## 3. Ajouter une Surveillance
Pour surveiller un nouveau site, cliquez sur le bouton **"Ajouter un site"**.

### Deux méthodes de surveillance :
1.  **Page Simple (Recommandé)** : Surveille une seule page précise (ex: une page de tarifs ou un article précis).
2.  **Site Complet** : L'outil explore plusieurs pages du même site pour trouver des changements (plus gourmand en crédits).

### Réglages conseillés :
- **Intervalle** : Choisissez la fréquence de passage (ex: toutes les heures ou tous les jours).
- **Vérifier immédiatement** : L'outil fera son premier passage dès que vous aurez enregistré.

---

## 4. Notifications (Emails et Slack)
Vous ne voulez sûrement pas rester devant l'écran toute la journée. Vous pouvez configurer l'outil pour vous prévenir ailleurs.

### Par Email :
- Allez dans les **Réglages** (Settings).
- Vérifiez que votre adresse email est correcte.
- Vous recevrez un résumé visuel des changements directement dans votre boîte.

### Par Slack (Pour recevoir les alertes sur votre messagerie pro) :
- Dans les réglages du site surveillé, choisissez "Webhook".
- Suivez les instructions simplifiées dans la fenêtre pour créer un "Webhook" sur Slack (c'est un lien magique à coller dans Kabuki).
- Vos alertes apparaîtront instantanément dans le canal Slack de votre choix !

---

## 5. L'Intelligence Artificielle (IA)
L'une des forces de Kabuki est qu'il "comprend" ce qu'il lit.
- **Analyse des changements** : L'IA compare la version d'hier et celle d'aujourd'hui. Elle vous explique avec des mots simples ce qui a changé.
- **Règles Go/No Go** : Dans les réglages avancés, vous pouvez donner des instructions à l'IA. 
    - *Exemple* : "Ne me préviens que si le prix baisse" ou "Alerte-moi si un nouvel appel d'offre apparaît pour le Sénégal".

---

## 6. Astuces pour les sites protégés
Certains sites demandent d'être connecté pour voir les informations. 
- Dans les **Options Avancées**, vous pouvez coller un "Cookie de session". 
- *Note : Cette partie est un peu plus technique, n'hésitez pas à demander de l'aide si besoin pour récupérer ce lien dans votre navigateur.*

---

## 7. Budget et Crédits (Firecrawl)
L'outil utilise des "crédits" pour chaque page visitée. Voici comment gérer votre budget :

### Combien ça coûte pour 10 pages ?
Si vous surveillez **10 pages** avec une vérification **toutes les 24h** :
- Vous consommez **10 crédits par jour**.
- Soit **300 crédits par mois**.

### L'Astuce "Gratuite" (Mode Malin 💡)
Le plan gratuit de Firecrawl offre **500 crédits** à la création du compte (valable une seule fois).
- Avec 10 pages surveillées, ces 500 crédits durent environ **50 jours** (soit 1 mois et demi).
- **Astuce** : Il est possible de créer un nouveau compte Firecrawl tous les 50 jours, de récupérer la nouvelle clé API et de la changer dans vos réglages pour repartir sur 500 crédits gratuits.

### L'Option Sérénité (20€ / mois)
Si vous ne souhaitez pas changer de compte régulièrement, le plan **Hobby** à environ **20€** vous offre **3 000 crédits** par mois.

### Nos Recommandations pour rentabiliser :
Si vous prenez l'abonnement à 20€, vous aurez beaucoup plus de crédits que nécessaire pour 10 pages. Profitez-en pour :
1.  **Augmenter la fréquence** : Passer d'une vérification par jour à une vérification toutes les **2 heures**.
2.  **Surveiller plus de pages** : Vous pouvez surveiller jusqu'à **100 pages** quotidiennement pour le même prix.

---

## 8. En résumé
1. **Ajoutez vos URLs**.
2. **Configurez votre IA (Mistral)** au besoin.
3. **Choisissez votre méthode de crédit** (Gratuit avec astuce ou Abonnement 20€).
4. **Détendez-vous** : Kabuki Observer fait le reste !

---
*Besoin d'aide ? Consultez la documentation technique ou contactez votre support.*
