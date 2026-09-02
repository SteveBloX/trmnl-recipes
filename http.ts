// Instance axios partagée avec retry automatique sur les erreurs réseau
// transitoires (ex. "socket hang up") — utilisée par tous les fetchers qui
// parlent à une API externe (iNaturalist, UNESCO). Retente au niveau de
// CHAQUE appel HTTP individuel, avant même que la logique de retry plus
// large (voir retry-with-alert.ts) n'ait besoin de refaire tout un tirage
// depuis le début à cause d'un seul appel qui a raté.
import axios from "axios";
import axiosRetry from "axios-retry";

export const http = axios.create();

axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  // Erreurs réseau/timeout par défaut, plus les 5xx — jamais sur les 4xx
  // (une requête mal formée ne se corrigera pas en la refaisant).
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.code === "ECONNRESET" ||
    error.code === "ECONNABORTED",
});
