import AsyncStorage from '@react-native-async-storage/async-storage';

// More complete interface based on Brave's API spec
interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
  is_source_local?: boolean;
  is_source_both?: boolean;
  age?: string;
  language?: string;
}

interface BraveSearchResponse {
  web: {
    results: BraveSearchResult[];
    total?: number;
    took?: number;
  };
  query?: {
    original: string;
    show_strict_warning?: boolean;
    auto_correction_engaged?: boolean;
    more_results_available?: boolean;
  };
}

export const checkBraveApiKey = async (): Promise<{ isValid: boolean; message?: string }> => {
  const apiKey = await AsyncStorage.getItem('braveApiKey');
  if (!apiKey) {
    return {
      isValid: false,
      message: 'Please enter your Brave Search API key in settings to enable search functionality.'
    };
  }
  return { isValid: true };
};

export const performBraveSearch = async (query: string): Promise<string> => {
  const apiKey = await AsyncStorage.getItem('braveApiKey');
  if (!apiKey) {
    throw new Error('Please enter your Brave Search API key in settings to enable search functionality.');
  }

  try {
    // Replace spaces with + in the query and construct URL directly
    const encodedQuery = query.replace(/\s+/g, '+');
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=5&summary=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip'
      }
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Failed to fetch search results: ${response.status} ${response.statusText}`);
    }

    let data: BraveSearchResponse;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (parseError: unknown) {
      if (parseError instanceof Error) {
        throw new Error(`Failed to parse API response: ${parseError.message}`);
      }
      throw new Error('Failed to parse API response: Unknown error');
    }

    // Check if we have results
    if (!data.web?.results?.length) {
      return 'No search results found.';
    }
    
    // Increment monthly query counter
    const currentQueries = await AsyncStorage.getItem('monthlyQueries') || '0';
    const newCount = (parseInt(currentQueries) + 1).toString();
    await AsyncStorage.setItem('monthlyQueries', newCount);

    // Format results for context with additional metadata when available
    const formattedResults = data.web.results.map(result => {
      let formattedResult = `Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}`;
      if (result.language) formattedResult += `\nLanguage: ${result.language}`;
      if (result.age) formattedResult += `\nAge: ${result.age}`;
      return formattedResult + '\n';
    }).join('\n');

    // Include query metadata if available
    let searchResponse = '';
    if (data.query?.auto_correction_engaged) {
      searchResponse += 'Note: Search query was auto-corrected.\n\n';
    }
    
    searchResponse += `Here are some relevant search results:\n\n${formattedResults}`;
    
    if (data.query?.more_results_available) {
      searchResponse += '\nMore results are available for this query.';
    }

    return searchResponse;
  } catch (error) {
    throw error;
  }
}; 