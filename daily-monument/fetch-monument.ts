import axios from "axios";

// UNESCO OpenDataSoft API URL
const UNESCO_API_URL =
  "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records";

/**
 * Retrieves a random World Heritage Site that has an image, with details in English.
 * @returns {Promise<Object|null>} An object containing the name and image URL, or null upon error.
 */
export async function fetchRandomMonument() {
  // Common filter: ensures the element has an image URL
  const baseParams = {
    where: "main_image_url IS NOT NULL AND category = 'Cultural'",
    lang: "en",
  };

  console.log("-> Querying UNESCO API for a random monument...");

  try {
    // 1. Get total count of matching records
    const countResponse = await axios.get(UNESCO_API_URL, {
      params: { ...baseParams, limit: 0 },
    });
    const totalCount = countResponse.data.total_count;

    if (!totalCount) {
      console.warn("No records found.");
      return null;
    }

    // 2. Fetch a random record using offset
    const randomOffset = Math.floor(Math.random() * totalCount);

    const params = {
      ...baseParams,
      select:
        "name_en, name_fr, name_es, name_ru, name_ar, name_zh, main_image_url, id_no, coordinates, iso_codes, short_description_en, short_description_fr, short_description_es, short_description_ru, short_description_ar, short_description_zh",
      limit: 1,
      offset: randomOffset,
    };

    const response = await axios.get(UNESCO_API_URL, {
      params: params,
    });

    const results = response.data.results;

    if (results && results.length > 0) {
      const record = results[0];

      // 3. Extracting Data
      const monumentData = {
        // Accessing the English name field
        name_en: record.name_en,
        name_fr: record.name_fr,
        name_es: record.name_es,
        name_ru: record.name_ru,
        name_ar: record.name_ar,
        name_zh: record.name_zh,
        imageURL: record.main_image_url?.url,
        officialURL: `https://whc.unesco.org/en/list/${record.id_no}`,
        coordinates: {
          lat: record.coordinates?.lat,
          lon: record.coordinates?.lon,
        },
        country_code: record.iso_codes,
        description_en: record.short_description_en,
        description_fr: record.short_description_fr,
        description_es: record.short_description_es,
        description_ru: record.short_description_ru,
        description_ar: record.short_description_ar,
        description_zh: record.short_description_zh,
      };

      return monumentData;
    } else {
      console.warn("API returned a valid response, but no record was found.");
      return null;
    }
  } catch (error: any) {
    if (error.response) {
      console.error("API Error Data:", error.response.data);
    }
    console.error("Error retrieving UNESCO monument:", error.message);
    return null;
  }
}
