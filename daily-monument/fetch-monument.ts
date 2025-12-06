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
        "name_en, main_image_url, id_no, coordinates, iso_codes, short_description_en",
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
        name: record.name_en,
        imageURL: record.main_image_url?.url,
        officialURL: `https://whc.unesco.org/en/list/${record.id_no}`,
        coordinates: {
          lat: record.coordinates?.lat,
          lon: record.coordinates?.lon,
        },
        country_code: record.iso_codes,
        description: record.short_description_en,
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
