import React from 'react';
import { View, Image, FlatList } from 'react-native';
import { styles } from '../Styles';

interface ThumbnailGalleryProps {
  thumbnails: string[];
}

const ThumbnailGallery: React.FC<ThumbnailGalleryProps> = ({ thumbnails }) => {
  if (!thumbnails || thumbnails.length === 0) return null;

  return (
    <View style={styles.thumbnailContainer}>
      <FlatList
        horizontal
        data={thumbnails}
        keyExtractor={(item, index) => `thumbnail-${index}`}
        renderItem={({ item }) => (
          <Image 
            source={{ uri: item }} 
            style={styles.thumbnail} 
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailList}
      />
    </View>
  );
};

export default ThumbnailGallery; 