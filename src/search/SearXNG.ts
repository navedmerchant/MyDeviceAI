import { HOSTNAME } from "../config/Env";

// Define interfaces for the SearXNG API response
interface SearXNGResult {
  url: string;
  title: string;
  content: string;
  // Add other fields if needed, e.g., engine, score, etc.
  thumbnail?: string;
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

// Define the return type for the search function
interface SearchResult {
  formattedText: string;
  thumbnails: string[];
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
async function performSearXNGSearch(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const baseUrl = HOSTNAME;
  const params = new URLSearchParams({
    q: query,
    format: "json",
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      // It's good practice to try and get more error info if possible
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    // Log raw response text before parsing
    const responseText = await response.text();

    let data: SearXNGResponse;
    try {
      data = JSON.parse(responseText); // Parse the logged text
    } catch (parseError: unknown) {
      if (parseError instanceof Error) {
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }
      throw new Error('Failed to parse API response: Unknown error');
    }

    if (!data.results || data.results.length === 0) {
      return {
        formattedText: "No search results found.",
        thumbnails: []
      };
    }

    // Take the first 5 results
    const topResults = data.results.slice(0, 5);
    
    // console.log('Top results:', topResults);
    // Collect thumbnails
    const thumbnails: string[] = topResults
      .filter(result => result.thumbnail)
      .map(result => result.thumbnail as string);

    const formattedResults = topResults.map(result => {
      // Ensure newlines are correctly within the template literal for the desired output string
      let formattedResult = `Title: ${result.title}
Content: ${result.content || 'No content available.'}
URL: ${result.url}`;
      // Add two newlines after each result's formatted string
      return formattedResult + '\n\n';
    }).join(''); // Join with an empty string, as newlines are already appended

    return {
      formattedText: `Here are some relevant search results:\n\n${formattedResults.trimEnd()}`,
      thumbnails
    };

  } catch (error) {
    // Re-throw the error so the caller can handle it
    // Or handle it more gracefully here, e.g., return an error message string
    if (error instanceof Error) {
        return {
          formattedText: `Error performing search: ${error.message}`,
          thumbnails: []
        };
    }
    return {
      formattedText: "An unknown error occurred during the search.",
      thumbnails: []
    };
  }
}

export { performSearXNGSearch };
export type { SearchResult };