// Define interfaces for the SearXNG API response
interface SearXNGResult {
  url: string;
  title: string;
  content: string;
  // Add other fields if needed, e.g., engine, score, etc.
  // thumbnail?: string;
  // engine?: string;
  // parsed_url?: string[];
  // img_src?: string;
  // priority?: string;
  // engines?: string[];
  // positions?: number[];
  // score?: number;
  // category?: string;
  // publishedDate?: string | null;
}

interface SearXNGResponse {
  query: string;
  number_of_results?: number; // Based on sample, might be 0 even with results
  results: SearXNGResult[];
  // answers?: any[]; // Add if needed
  // corrections?: any[]; // Add if needed
  // infoboxes?: any[]; // Add if needed
  // suggestions?: string[]; // Add if needed
}

// Renamed and updated function
async function performSearXNGSearch(query: string): Promise<string> {
  const baseUrl = "https://SAMPLE_URL";
  const params = new URLSearchParams({
    q: query,
    format: "json",
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // It's good practice to try and get more error info if possible
      const errorText = await response.text();
      console.error("SearXNG API Error Text:", errorText); // Log error text
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    // Log raw response text before parsing
    const responseText = await response.text();
    console.log("SearXNG Raw Response Text:", responseText);

    let data: SearXNGResponse;
    try {
      data = JSON.parse(responseText); // Parse the logged text
      console.log("SearXNG Parsed Data:", JSON.stringify(data, null, 2)); // Log parsed data
    } catch (parseError: unknown) {
      if (parseError instanceof Error) {
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }
      throw new Error('Failed to parse API response: Unknown error');
    }

    if (!data.results || data.results.length === 0) {
      return "No search results found.";
    }

    // Take the first 5 results
    const topResults = data.results.slice(0, 5);
    console.log("SearXNG Top Results:", JSON.stringify(topResults, null, 2)); // Log top results

    const formattedResults = topResults.map(result => {
      // Ensure newlines are correctly within the template literal for the desired output string
      let formattedResult = `Title: ${result.title}\nContent: ${result.content || 'No content available.'}\nURL: ${result.url}`;
      // Add two newlines after each result's formatted string
      return formattedResult + '\n\n';
    }).join(''); // Join with an empty string, as newlines are already appended

    console.log("SearXNG Formatted Results String:", formattedResults); // Log formatted results string

    return `Here are some relevant search results:\n\n${formattedResults.trimEnd()}`;

  } catch (error) {
    console.error("Error fetching from SearXNG:", error);
    // Re-throw the error so the caller can handle it
    // Or handle it more gracefully here, e.g., return an error message string
    if (error instanceof Error) {
        return `Error performing search: ${error.message}`;
    }
    return "An unknown error occurred during the search.";
  }
}

export { performSearXNGSearch };