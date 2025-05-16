import React from 'react';
import { View, Image, TouchableOpacity, FlatList } from 'react-native';
import { styles } from '../Styles';

interface ThumbnailGalleryProps {
  thumbnails: string[];
  onImagePress: (url: string) => void;
}

const ThumbnailGallery: React.FC<ThumbnailGalleryProps> = ({ thumbnails, onImagePress }) => {
  if (!thumbnails || thumbnails.length === 0) return null;

  return (
    <View style={styles.thumbnailContainer}>
      <FlatList
        horizontal
        data={thumbnails}
        keyExtractor={(item, index) => `thumbnail-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onImagePress(item)}>
            <Image 
              source={{ uri: item }} 
              style={styles.thumbnail} 
            />
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailList}
      />
    </View>
  );
};

export default ThumbnailGallery; 