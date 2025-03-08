import AsyncStorage from '@react-native-async-storage/async-storage';

interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
}

interface BraveSearchResponse {
  web: {
    results: BraveSearchResult[];
  };
}

export const performBraveSearch = async (query: string): Promise<string> => {
  const apiKey = await AsyncStorage.getItem('braveApiKey');
  if (!apiKey) {
    throw new Error('Brave Search API key not found. Please add it in settings.');
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.append('q', query);
    url.searchParams.append('count', '5');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch search results');
    }

    const data: BraveSearchResponse = await response.json();
    
    // Increment monthly query counter
    const currentQueries = await AsyncStorage.getItem('monthlyQueries') || '0';
    const newCount = (parseInt(currentQueries) + 1).toString();
    await AsyncStorage.setItem('monthlyQueries', newCount);

    // Format results for context
    const formattedResults = data.web.results.map(result => (
      `Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}\n`
    )).join('\n');

    return `Here are some relevant search results:\n\n${formattedResults}`;
  } catch (error) {
    console.error('Brave search error:', error);
    throw error;
  }
}; 