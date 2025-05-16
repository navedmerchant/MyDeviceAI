import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import { RouteProp } from '@react-navigation/native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

type ImageGalleryScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'ImageGallery'>;
type ImageGalleryScreenRouteProp = RouteProp<DrawerParamList, 'ImageGallery'>;

interface ImageGalleryScreenProps {
  navigation: ImageGalleryScreenNavigationProp;
  route: ImageGalleryScreenRouteProp;
}

const { width, height } = Dimensions.get('window');

const ImageGalleryScreen: React.FC<ImageGalleryScreenProps> = ({ navigation, route }) => {
  const { images, initialIndex } = route.params;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri: item }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );

  const handleBack = () => {
    navigation.goBack();
  };

  const handlePageChange = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator}>
          {currentIndex + 1} / {images.length}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Image Gallery */}
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          handlePageChange(newIndex);
        }}
      />

      {/* Navigation Buttons */}
      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={goToPrevious}
          disabled={currentIndex === 0}
        >
          <ArrowLeft color={currentIndex === 0 ? '#666' : '#fff'} size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === images.length - 1 && styles.navButtonDisabled]}
          onPress={goToNext}
          disabled={currentIndex === images.length - 1}
        >
          <ArrowRight color={currentIndex === images.length - 1 ? '#666' : '#fff'} size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  pageIndicator: {
    color: '#fff',
    fontSize: 16,
  },
  placeholder: {
    width: 50,
  },
  imageContainer: {
    width,
    height: height - 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
});

export default ImageGalleryScreen; 