// GraphQL documents sent to AniList. Each has an operation name, which the
// cache key and the e2e mock use. Null variables are ignored by AniList, so
// one Browse query serves top lists, search and random.

const CARD = `
fragment card on Media {
  id idMal type format status episodes chapters seasonYear isAdult countryOfOrigin
  startDate { year }
  averageScore popularity genres
  title { romaji english }
  coverImage { large extraLarge }
}`

export const BROWSE = `
query Browse($type: MediaType, $page: Int, $perPage: Int, $sort: [MediaSort], $search: String,
  $status: MediaStatus, $format_in: [MediaFormat], $genre_in: [String], $country: CountryCode,
  $scoreGreater: Int, $startGreater: FuzzyDateInt, $startLesser: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage lastPage hasNextPage }
    media(type: $type, sort: $sort, search: $search, status: $status, format_in: $format_in,
      genre_in: $genre_in, countryOfOrigin: $country, averageScore_greater: $scoreGreater,
      startDate_greater: $startGreater, startDate_lesser: $startLesser, isAdult: false) { ...card }
  }
}
${CARD}`

export const HOME = `
query Home($season: MediaSeason, $year: Int) {
  season: Page(perPage: 20) {
    media(type: ANIME, season: $season, seasonYear: $year, isAdult: false, sort: [POPULARITY_DESC]) { ...card }
  }
  airing: Page(perPage: 15) {
    media(type: ANIME, status: RELEASING, isAdult: false, sort: [SCORE_DESC]) { ...card }
  }
  top: Page(perPage: 15) {
    media(type: ANIME, isAdult: false, sort: [SCORE_DESC]) { ...card }
  }
  upcoming: Page(perPage: 15) {
    media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, sort: [POPULARITY_DESC]) { ...card }
  }
  manga: Page(perPage: 15) {
    media(type: MANGA, isAdult: false, sort: [POPULARITY_DESC]) { ...card }
  }
}
${CARD}`

export const QUICK_SEARCH = `
query QuickSearch($search: String) {
  anime: Page(perPage: 5) { media(type: ANIME, search: $search, isAdult: false, sort: [SEARCH_MATCH]) { ...card } }
  manga: Page(perPage: 3) { media(type: MANGA, search: $search, isAdult: false, sort: [SEARCH_MATCH]) { ...card } }
}
${CARD}`

// Characters and recommendations come in the same request as the detail.
export const DETAIL = `
query Detail($idMal: Int, $type: MediaType) {
  Media(idMal: $idMal, type: $type) {
    ...card
    siteUrl description(asHtml: false) season duration source volumes favourites bannerImage
    title { native }
    startDate { year month day }
    endDate { year month day }
    rankings { rank type allTime }
    tags { name category rank isMediaSpoiler }
    studios(isMain: true) { nodes { name } }
    trailer { id site }
    nextAiringEpisode { airingAt episode }
    externalLinks { site type url }
    stats { scoreDistribution { amount } }
    relations { edges { relationType node { idMal type title { romaji english } } } }
    staff(sort: [RELEVANCE], perPage: 8) { edges { role node { name { full } } } }
    characters(sort: [ROLE, RELEVANCE], perPage: 12) {
      edges {
        role
        node { id name { full } image { medium } }
        voiceActors(language: JAPANESE, sort: [RELEVANCE]) { name { full } image { medium } }
      }
    }
    recommendations(sort: [RATING_DESC], perPage: 14) { nodes { rating mediaRecommendation { ...card } } }
  }
}
${CARD}`

export const SCHEDULE = `
query Schedule($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: [TIME]) {
      airingAt episode media { ...card }
    }
  }
}
${CARD}`

// Episode list for the Episodes tab: air dates from the airing schedule,
// titles from streaming listings when AniList has them.
export const EPISODES = `
query Episodes($idMal: Int, $page: Int) {
  Media(idMal: $idMal, type: ANIME) {
    episodes
    coverImage { extraLarge }
    bannerImage
    streamingEpisodes { title thumbnail }
    airingSchedule(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      nodes { episode airingAt }
    }
  }
}`

export const GENRES = `
query Genres { GenreCollection }`
