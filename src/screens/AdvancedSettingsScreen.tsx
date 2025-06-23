import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import { ChevronLeft, Download, Search, Trash2, Settings, HardDrive, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import RNFS from 'react-native-fs';
import { ModelParameters, DEFAULT_PARAMETERS } from '../utils/Utils';

type AdvancedSettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'AdvancedSettings'>;

type Props = {
  navigation: AdvancedSettingsScreenNavigationProp;
};

interface HuggingFaceModel {
  id: string;
  modelId: string;
  author: string;
  sha: string;
  downloads: number;
  likes: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pipeline_tag?: string;
  library_name?: string;
}

interface DownloadedModel {
  id: string;
  name: string;
  author: string;
  size: string;
  downloadDate: string;
  filePath: string;
  isActive: boolean;
  parameters?: ModelParameters;
  downloadStatus?: 'downloading' | 'paused' | 'cancelled' | 'completed' | 'failed';
  downloadProgress?: number;
  downloadJob?: any; // To store the RNFS download job for pause/cancel
}

interface GGUFFile {
  path: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
  } | null;
}

const AdvancedSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HuggingFaceModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const [downloadJobs, setDownloadJobs] = useState<{[key: string]: any}>({});
  const [activeTab, setActiveTab] = useState<'search' | 'downloaded'>('downloaded');
  const [showGGUFModal, setShowGGUFModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(null);
  const [availableGGUFFiles, setAvailableGGUFFiles] = useState<GGUFFile[]>([]);
  const [loadingGGUFFiles, setLoadingGGUFFiles] = useState(false);
  const [totalStorageUsed, setTotalStorageUsed] = useState<string>('0 B');
  
  // Parameter configuration modal state
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [selectedModelForConfig, setSelectedModelForConfig] = useState<DownloadedModel | null>(null);
  const [tempParameters, setTempParameters] = useState<ModelParameters>(DEFAULT_PARAMETERS);

  useEffect(() => {
    loadDownloadedModels();
  }, []);

  useEffect(() => {
    calculateStorageUsage();
  }, [downloadedModels]);

  const loadDownloadedModels = async () => {
    try {
      const stored = await AsyncStorage.getItem('downloadedModels');
      const activeModelId = await AsyncStorage.getItem('activeModelId');
      let models: DownloadedModel[] = [];
      
      if (stored) {
        models = JSON.parse(stored);
      }
      
      // Determine if built-in model should be active
      const shouldBuiltInBeActive = !activeModelId || activeModelId === 'built-in-default';
      
      // Always include the built-in default model
      const builtInModel: DownloadedModel = {
        id: 'built-in-default',
        name: 'Built-in Default Model',
        author: 'Qwen3 1.7B',
        size: 'Built-in',
        downloadDate: new Date().toISOString(),
        filePath: '', // No file path for built-in model
        isActive: shouldBuiltInBeActive,
      };
      
      // Check if built-in model already exists in the list
      const hasBuiltIn = models.some(m => m.id === 'built-in-default');
      if (!hasBuiltIn) {
        models.unshift(builtInModel); // Add at the beginning
      } else {
        // Update the existing built-in model to ensure it has correct properties
        const builtInIndex = models.findIndex(m => m.id === 'built-in-default');
        models[builtInIndex] = { ...models[builtInIndex], ...builtInModel };
      }
      
      // Set other models' active status based on activeModelId
      if (activeModelId && activeModelId !== 'built-in-default') {
        models = models.map(model => ({
          ...model,
          isActive: model.id === activeModelId
        }));
      } else {
        // If no activeModelId or it's the built-in model, make sure only built-in is active
        models = models.map(model => ({
          ...model,
          isActive: model.id === 'built-in-default'
        }));
      }
      
      setDownloadedModels(models);
    } catch (error) {
      console.error('Error loading downloaded models:', error);
    }
  };

  const saveDownloadedModels = async (models: DownloadedModel[]) => {
    try {
      await AsyncStorage.setItem('downloadedModels', JSON.stringify(models));
      setDownloadedModels(models);
    } catch (error) {
      console.error('Error saving downloaded models:', error);
    }
  };

  const searchHuggingFaceModels = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    setIsSearching(true);
    try {
      // Search for GGUF models on Hugging Face
      const response = await fetch(
        `https://huggingface.co/api/models?search=${encodeURIComponent(searchQuery)}&filter=gguf&sort=downloads&direction=-1&limit=20`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search models');
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching models:', error);
      Alert.alert('Error', 'Failed to search for models. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const showGGUFFilesForModel = async (model: HuggingFaceModel) => {
    setSelectedModel(model);
    setLoadingGGUFFiles(true);
    setShowGGUFModal(true);
    
    try {
      // Get model files to find GGUF files
      const filesResponse = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
      const files = await filesResponse.json();
      
      // Find GGUF files
      const ggufFiles = files.filter((file: any) => 
        file.path.toLowerCase().endsWith('.gguf')
      );
      
      if (ggufFiles.length === 0) {
        setShowGGUFModal(false);
        Alert.alert('Error', 'No GGUF files found in this model');
        return;
      }
      
      setAvailableGGUFFiles(ggufFiles);
    } catch (error) {
      console.error('Error fetching GGUF files:', error);
      setShowGGUFModal(false);
      Alert.alert('Error', 'Failed to fetch model files. Please try again.');
    } finally {
      setLoadingGGUFFiles(false);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'This app needs access to storage to download models',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const downloadSelectedGGUF = async (ggufFile: GGUFFile) => {
    if (!selectedModel) return;
    
    // Request storage permission
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage permission is required to download files');
      return;
    }
    
    const downloadKey = `${selectedModel.id}/${ggufFile.path}`;
    setIsDownloading(selectedModel.id);
    setShowGGUFModal(false);
    
    try {
      // Create file path
      const fileName = `${selectedModel.id.replace('/', '_')}_${ggufFile.path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const modelsDir = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/models`
        : `${RNFS.ExternalDirectoryPath}/models`;
      
      // Ensure models directory exists
      await RNFS.mkdir(modelsDir);
      
      const filePath = `${modelsDir}/${fileName}`;
      
      // Check if file already exists
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        Alert.alert('File Exists', 'This model file already exists. Do you want to re-download it?', [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Re-download', 
            onPress: async () => {
              await RNFS.unlink(filePath);
              downloadSelectedGGUF(ggufFile);
            }
          }
        ]);
        return;
      }
      
      // Create downloading model entry immediately
      const downloadingModel: DownloadedModel = {
        id: downloadKey,
        name: ggufFile.path,
        author: selectedModel.id.split('/')[0] || 'Unknown',
        size: formatFileSize(ggufFile.lfs?.size || ggufFile.size || 0),
        downloadDate: new Date().toISOString(),
        filePath: filePath,
        isActive: false,
        downloadStatus: 'downloading',
        downloadProgress: 0,
      };
      
      // Add to downloaded models list immediately
      const updatedModels = [...downloadedModels, downloadingModel];
      setDownloadedModels(updatedModels);
      
      // Switch to downloaded tab
      setActiveTab('downloaded');
      
      // Construct download URL
      const downloadUrl = `https://huggingface.co/${selectedModel.id}/resolve/main/${ggufFile.path}`;
      
      console.log("downloadUrl", downloadUrl);
      console.log("filePath", filePath);

      // Start download with progress tracking
      const downloadResult = RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: filePath,
        begin: (res) => {
          if (!res.contentLength || res.contentLength === 0) {
            console.warn('Server did not provide Content-Length header, progress tracking may not work');
          }

          setDownloadedModels(prev => prev.map(model => 
            model.id === downloadKey 
              ? { 
                  ...model, 
                  downloadStatus: 'downloading',
                  downloadProgress: 0 
                }
              : model
          ));
        },
        progress: (res) => {
          if (res.contentLength && res.contentLength > 0) {
            const progress = (res.bytesWritten / res.contentLength) * 100;
            console.log("progress", progress);
            
            setDownloadedModels(prev => prev.map(model => 
              model.id === downloadKey 
                ? { ...model, downloadProgress: progress }
                : model
            ));
          } else {
            console.log(`Downloaded: ${formatFileSize(res.bytesWritten)}`);
            setDownloadedModels(prev => prev.map(model => 
              model.id === downloadKey 
                ? { 
                    ...model, 
                    downloadProgress: -1,
                    size: formatFileSize(res.bytesWritten)
                  }
                : model
            ));
          }
        },
        progressDivider: 1,
      });
      
      // Store the download job for pause/cancel functionality
      setDownloadJobs(prev => ({ ...prev, [downloadKey]: downloadResult }));
      
      // Wait for download to complete
      const result = await downloadResult.promise;
      
      if (result.statusCode !== 200) {
        throw new Error(`Download failed with status code: ${result.statusCode}`);
      }
      
      // Get actual downloaded file size
      const fileInfo = await RNFS.stat(filePath);
      const actualSize = fileInfo.size;
      
      // Update model with completion status
      const completedModel: DownloadedModel = {
        ...downloadingModel,
        size: formatFileSize(actualSize),
        downloadStatus: 'completed',
        downloadProgress: 100,
      };
      
      const finalModels = downloadedModels.map(model => 
        model.id === downloadKey ? completedModel : model
      ).concat(downloadedModels.find(m => m.id === downloadKey) ? [] : [completedModel]);
      
      await saveDownloadedModels(finalModels);
      
      // Clean up download job
      setDownloadJobs(prev => {
        const newJobs = { ...prev };
        delete newJobs[downloadKey];
        return newJobs;
      });
      
      Alert.alert('Success', `Model "${completedModel.name}" has been downloaded successfully!`);
    } catch (error) {
      console.error('Error downloading model:', error);
      
      // Update model status to failed
      setDownloadedModels(prev => prev.map(model => 
        model.id === downloadKey 
          ? { ...model, downloadStatus: 'failed' as const }
          : model
      ));
      
      // Clean up partial download if it exists
      try {
        const fileName = `${selectedModel.id.replace('/', '_')}_${ggufFile.path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const modelsDir = Platform.OS === 'ios' 
          ? `${RNFS.DocumentDirectoryPath}/models`
          : `${RNFS.ExternalDirectoryPath}/models`;
        const filePath = `${modelsDir}/${fileName}`;
        
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          await RNFS.unlink(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up partial download:', cleanupError);
      }
      
      // Clean up download job
      setDownloadJobs(prev => {
        const newJobs = { ...prev };
        delete newJobs[downloadKey];
        return newJobs;
      });
      
      Alert.alert('Error', `Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateStorageUsage = async () => {
    try {
      let totalBytes = 0;
      
      for (const model of downloadedModels) {
        // Skip built-in model for storage calculation
        if (model.id === 'built-in-default') continue;
        
        if (model.filePath) {
          const fileExists = await RNFS.exists(model.filePath);
          if (fileExists) {
            const fileInfo = await RNFS.stat(model.filePath);
            totalBytes += fileInfo.size;
          }
        }
      }
      
      setTotalStorageUsed(formatFileSize(totalBytes));
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      setTotalStorageUsed('Error calculating');
    }
  };

  const deleteModel = async (modelId: string) => {
    // Prevent deletion of built-in model
    if (modelId === 'built-in-default') {
      Alert.alert('Cannot Delete', 'The built-in default model cannot be deleted.');
      return;
    }
    
    Alert.alert(
      'Delete Model',
      'Are you sure you want to delete this model? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
                      try {
            // Find the model to get its file path and check if it was active
            const modelToDelete = downloadedModels.find(m => m.id === modelId);
            const wasActiveModel = modelToDelete?.isActive;
            
            if (modelToDelete && modelToDelete.filePath) {
              // Delete the actual file
              const fileExists = await RNFS.exists(modelToDelete.filePath);
              if (fileExists) {
                await RNFS.unlink(modelToDelete.filePath);
              }
            }
            
            // Remove from downloaded models list
            const updatedModels = downloadedModels.filter(m => m.id !== modelId);
            
            // Check if only built-in model remains or if we deleted the active model
            const nonBuiltInModels = updatedModels.filter(m => m.id !== 'built-in-default');
            if (nonBuiltInModels.length === 0 || wasActiveModel) {
              // Set built-in model as active
              const finalModels = updatedModels.map(model => ({
                ...model,
                isActive: model.id === 'built-in-default'
              }));
              await saveDownloadedModels(finalModels);
              await AsyncStorage.setItem('activeModelId', 'built-in-default');
            } else {
              await saveDownloadedModels(updatedModels);
            }
            
            Alert.alert('Success', 'Model deleted successfully');
          } catch (error) {
            console.error('Error deleting model:', error);
            Alert.alert('Error', 'Failed to delete model file, but removed from list');
            
            // Still remove from list even if file deletion failed
            const updatedModels = downloadedModels.filter(m => m.id !== modelId);
            
            // Check if we need to set built-in as active after failed deletion
            const modelToDelete = downloadedModels.find(m => m.id === modelId);
            const wasActiveModel = modelToDelete?.isActive;
            const nonBuiltInModels = updatedModels.filter(m => m.id !== 'built-in-default');
            
            if (nonBuiltInModels.length === 0 || wasActiveModel) {
              // Set built-in model as active
              const finalModels = updatedModels.map(model => ({
                ...model,
                isActive: model.id === 'built-in-default'
              }));
              await saveDownloadedModels(finalModels);
              await AsyncStorage.setItem('activeModelId', 'built-in-default');
            } else {
              await saveDownloadedModels(updatedModels);
            }
          }
          }
        }
      ]
    );
  };

  const setActiveModel = async (modelId: string) => {
    const updatedModels = downloadedModels.map(model => ({
      ...model,
      isActive: model.id === modelId
    }));
    await saveDownloadedModels(updatedModels);
    await AsyncStorage.setItem('activeModelId', modelId);
  };

  const openParameterConfig = (model: DownloadedModel) => {
    setSelectedModelForConfig(model);
    setTempParameters(model.parameters || DEFAULT_PARAMETERS);
    setShowParameterModal(true);
  };

  const saveModelParameters = async () => {
    if (!selectedModelForConfig) return;

    // Check if initialization parameters changed (requires model reload)
    const oldParams = selectedModelForConfig.parameters || DEFAULT_PARAMETERS;
    const initParamsChanged = 
      oldParams.n_ctx !== tempParameters.n_ctx || 
      oldParams.n_gpu_layers !== tempParameters.n_gpu_layers;

    const updatedModels = downloadedModels.map(model => {
      if (model.id === selectedModelForConfig.id) {
        return {
          ...model,
          parameters: tempParameters
        };
      }
      return model;
    });

    await saveDownloadedModels(updatedModels);
    
    // Set flag to indicate model needs reloading if this is the active model
    if (selectedModelForConfig.isActive && initParamsChanged) {
      await AsyncStorage.setItem('modelNeedsReload', 'true');
    }
    
    setShowParameterModal(false);
    setSelectedModelForConfig(null);
    
    if (selectedModelForConfig.isActive && initParamsChanged) {
      Alert.alert(
        'Parameters Updated', 
        'Context length or GPU layers were changed. The model will reload automatically on your next message.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Success', 'Model parameters updated successfully!');
    }
  };

  const resetParametersToDefault = () => {
    setTempParameters(DEFAULT_PARAMETERS);
  };

  const pauseDownload = async (modelId: string) => {
    const downloadJob = downloadJobs[modelId];
    if (downloadJob) {
      try {
        downloadJob.stop();
        setDownloadedModels(prev => prev.map(model => 
          model.id === modelId 
            ? { ...model, downloadStatus: 'paused' as const }
            : model
        ));
      } catch (error) {
        console.error('Error pausing download:', error);
      }
    }
  };

  const cancelDownload = async (modelId: string) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const downloadJob = downloadJobs[modelId];
            if (downloadJob) {
              try {
                downloadJob.stop();
                
                // Remove the model from downloaded list
                const updatedModels = downloadedModels.filter(m => m.id !== modelId);
                setDownloadedModels(updatedModels);
                
                // Clean up partial download file
                const modelToDelete = downloadedModels.find(m => m.id === modelId);
                if (modelToDelete && modelToDelete.filePath) {
                  const fileExists = await RNFS.exists(modelToDelete.filePath);
                  if (fileExists) {
                    await RNFS.unlink(modelToDelete.filePath);
                  }
                }
                
                // Clean up download job
                setDownloadJobs(prev => {
                  const newJobs = { ...prev };
                  delete newJobs[modelId];
                  return newJobs;
                });
                
                setIsDownloading(null);
              } catch (error) {
                console.error('Error canceling download:', error);
              }
            }
          }
        }
      ]
    );
  };

  const resumeDownload = async (modelId: string) => {
    const model = downloadedModels.find(m => m.id === modelId);
    if (!model) return;
    
    // Find the original GGUF file info to resume download
    const [originalModelId, fileName] = modelId.split('/');
    const ggufFile: GGUFFile = {
      path: fileName,
      size: 0, // We'll use the stored size from the model
    };
    
    // Temporarily set the selected model to resume download
    const originalModel: HuggingFaceModel = {
      id: originalModelId,
      modelId: originalModelId,
      author: model.author,
      sha: '',
      downloads: 0,
      likes: 0,
      tags: [],
      createdAt: '',
      updatedAt: '',
    };
    
    // Remove the paused model first
    const updatedModels = downloadedModels.filter(m => m.id !== modelId);
    setDownloadedModels(updatedModels);
    
    // Clean up any existing partial file
    if (model.filePath) {
      const fileExists = await RNFS.exists(model.filePath);
      if (fileExists) {
        await RNFS.unlink(model.filePath);
      }
    }
    
    // Restart the download
    setSelectedModel(originalModel);
    await downloadSelectedGGUF(ggufFile);
  };

  const renderSearchResult = ({ item }: { item: HuggingFaceModel }) => {
    const hasActiveDownload = downloadedModels.some(model => 
      model.id.startsWith(item.id) && model.downloadStatus === 'downloading'
    );
    
    return (
      <View style={styles.modelCard}>
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>{item.id}</Text>
          <Text style={styles.modelAuthor}>by {item.id.split('/')[0]}</Text>
          <View style={styles.modelStats}>
            <Text style={styles.modelStat}>⬇ {item.downloads?.toLocaleString() || 0}</Text>
            <Text style={styles.modelStat}>♥ {item.likes?.toLocaleString() || 0}</Text>
          </View>
          {item.pipeline_tag && (
            <Text style={styles.modelTag}>{item.pipeline_tag}</Text>
          )}
          {hasActiveDownload && (
            <Text style={styles.downloadingText}>Download in progress - check Downloaded tab</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.downloadButton, (isDownloading === item.id || hasActiveDownload) && styles.downloadingButton]}
          onPress={() => showGGUFFilesForModel(item)}
          disabled={isDownloading === item.id || hasActiveDownload}
        >
          {isDownloading === item.id || hasActiveDownload ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Download color="#fff" size={20} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderDownloadedModel = ({ item }: { item: DownloadedModel }) => (
    <View style={[styles.modelCard, item.isActive && styles.activeModelCard, item.id === 'built-in-default' && styles.builtInModelCard]}>
      <View style={styles.modelInfo}>
        <Text style={styles.modelName}>{item.name}</Text>
        <Text style={styles.modelAuthor}>by {item.author}</Text>
        <Text style={styles.modelSize}>Size: {item.size}</Text>
        
        {/* Download progress for downloading models */}
        {item.downloadStatus === 'downloading' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Downloading: {item.downloadProgress?.toFixed(1) || 0}%
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${item.downloadProgress || 0}%` }]} />
            </View>
          </View>
        )}
        
        {/* Status indicators */}
        {item.downloadStatus === 'paused' && (
          <Text style={styles.pausedLabel}>PAUSED</Text>
        )}
        {item.downloadStatus === 'failed' && (
          <Text style={styles.failedLabel}>FAILED</Text>
        )}
        
        {item.id !== 'built-in-default' && item.downloadStatus === 'completed' && (
          <Text style={styles.downloadDate}>
            Downloaded: {new Date(item.downloadDate).toLocaleDateString()}
          </Text>
        )}
        {item.id === 'built-in-default' && (
          <Text style={styles.builtInLabel}>Default model included with the app</Text>
        )}
        {item.isActive && (
          <Text style={styles.activeLabel}>ACTIVE</Text>
        )}
      </View>
      <View style={styles.modelActions}>
        {/* Download control buttons */}
        {item.downloadStatus === 'downloading' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.pauseButton]}
              onPress={() => pauseDownload(item.id)}
            >
              <Text style={styles.actionButtonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => cancelDownload(item.id)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        
        {item.downloadStatus === 'paused' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.resumeButton]}
              onPress={() => resumeDownload(item.id)}
            >
              <Text style={styles.actionButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => cancelDownload(item.id)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        
        {item.downloadStatus === 'failed' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={() => resumeDownload(item.id)}
            >
              <Text style={styles.actionButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteModel(item.id)}
            >
              <Trash2 color="#ff4444" size={16} />
            </TouchableOpacity>
          </>
        )}
        
        {/* Normal actions for completed models */}
        {(item.downloadStatus === 'completed' || !item.downloadStatus) && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.configButton]}
              onPress={() => openParameterConfig(item)}
            >
              <Settings color="#28a745" size={16} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.activateButton,
                item.isActive && styles.disabledButton
              ]}
              onPress={() => setActiveModel(item.id)}
              disabled={item.isActive}
            >
              <Text style={[
                styles.actionButtonText,
                item.isActive && styles.disabledButtonText
              ]}>
                {item.isActive ? 'Active' : 'Activate'}
              </Text>
            </TouchableOpacity>
            {item.id !== 'built-in-default' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => deleteModel(item.id)}
              >
                <Trash2 color="#ff4444" size={16} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color="#fff" size={24} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <HardDrive color="#fff" size={24} />
          <Text style={styles.title}>Advanced</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloaded' && styles.activeTab]}
          onPress={() => setActiveTab('downloaded')}
        >
          <HardDrive color={activeTab === 'downloaded' ? '#007AFF' : '#666'} size={20} />
          <Text style={[styles.tabText, activeTab === 'downloaded' && styles.activeTabText]}>
            Downloaded ({downloadedModels.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Search color={activeTab === 'search' ? '#007AFF' : '#666'} size={20} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search Models
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'search' ? (
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search GGUF models on Hugging Face..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchHuggingFaceModels}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchHuggingFaceModels}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Search color="#fff" size={20} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>
            Search Results ({searchResults.length})
          </Text>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No models found. Try a different search term.' : 'Enter a search query to find GGUF models'}
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.downloadedHeader}>
            <Text style={styles.sectionTitle}>
              Downloaded Models ({downloadedModels.length})
            </Text>
            <Text style={styles.storageInfo}>
              Storage used: {totalStorageUsed}
            </Text>
          </View>
          
          <FlatList
            data={downloadedModels}
            renderItem={renderDownloadedModel}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No models downloaded yet. Search and download models to get started.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* GGUF Files Selection Modal */}
      <Modal
        visible={showGGUFModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGGUFModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select GGUF File
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowGGUFModal(false)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>
          
          {selectedModel && (
            <View style={styles.modalModelInfo}>
              <Text style={styles.modalModelName}>{selectedModel.id}</Text>
              <Text style={styles.modalModelAuthor}>by {selectedModel.id.split('/')[0]}</Text>
            </View>
          )}

          {loadingGGUFFiles ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.modalLoadingText}>Loading GGUF files...</Text>
            </View>
          ) : (
            <FlatList
              data={availableGGUFFiles}
              keyExtractor={(item) => item.path}
              style={styles.ggufFilesList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ggufFileItem}
                  onPress={() => downloadSelectedGGUF(item)}
                >
                  <View style={styles.ggufFileInfo}>
                    <Text style={styles.ggufFileName}>{item.path}</Text>
                    <Text style={styles.ggufFileSize}>
                      Size: {formatFileSize(item.lfs?.size || item.size || 0)}
                    </Text>
                  </View>
                  <Download color="#007AFF" size={20} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No GGUF files found</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Parameter Configuration Modal */}
      <Modal
        visible={showParameterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowParameterModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Configure Model Parameters
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowParameterModal(false)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>
          
          {selectedModelForConfig && (
            <View style={styles.modalModelInfo}>
              <Text style={styles.modalModelName}>{selectedModelForConfig.name}</Text>
              <Text style={styles.modalModelAuthor}>by {selectedModelForConfig.author}</Text>
            </View>
          )}

          <ScrollView style={styles.parameterConfigContainer}>
            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Context & GPU Settings</Text>
              
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Context Length (n_ctx)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.n_ctx.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    n_ctx: parseInt(text) || 0
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>GPU Layers (n_gpu_layers)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.n_gpu_layers.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    n_gpu_layers: parseInt(text) || 0
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Max Tokens (n_predict)</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.n_predict.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    n_predict: parseInt(text) || 0
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Sampling Parameters</Text>
              
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Temperature</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.temperature.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    temperature: parseFloat(text) || 0
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Top P</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.top_p.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    top_p: parseFloat(text) || 0
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Top K</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.top_k.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    top_k: parseInt(text) || 0
                  }))}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Min P</Text>
                <TextInput
                  style={styles.parameterInput}
                  value={tempParameters.min_p.toString()}
                  onChangeText={(text) => setTempParameters(prev => ({
                    ...prev,
                    min_p: parseFloat(text) || 0
                  }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.parameterSection}>
              <Text style={styles.parameterSectionTitle}>Stop Sequences</Text>
              <Text style={styles.parameterDescription}>
                Enter stop sequences separated by commas
              </Text>
              <TextInput
                style={[styles.parameterInput, styles.stopSequenceInput]}
                value={tempParameters.stop.join(', ')}
                onChangeText={(text) => setTempParameters(prev => ({
                  ...prev,
                  stop: text.split(',').map(s => s.trim()).filter(s => s.length > 0)
                }))}
                multiline
                placeholderTextColor="#666"
                placeholder="<|im_end|>, <|im_start|>, <|end|>"
              />
            </View>

            <View style={styles.parameterButtonContainer}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetParametersToDefault}
              >
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveModelParameters}
              >
                <Text style={styles.saveButtonText}>Save Parameters</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  placeholder: {
    width: 80,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#666',
    fontSize: 16,
    marginLeft: 8,
  },
  activeTabText: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultsList: {
    flex: 1,
  },
  modelCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeModelCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  builtInModelCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modelAuthor: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  modelStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  modelStat: {
    color: '#666',
    fontSize: 12,
  },
  modelTag: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  modelSize: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  downloadDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  activeLabel: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  builtInLabel: {
    color: '#34C759',
    fontSize: 12,
    fontStyle: 'italic',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadingButton: {
    backgroundColor: '#666',
  },
  modelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  activateButton: {
    backgroundColor: '#007AFF',
  },
  configButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
  },
  modalModelInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalModelName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalModelAuthor: {
    color: '#999',
    fontSize: 14,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  ggufFilesList: {
    flex: 1,
    padding: 16,
  },
  ggufFileItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ggufFileInfo: {
    flex: 1,
  },
  ggufFileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ggufFileSize: {
    color: '#999',
    fontSize: 14,
  },
  // Progress bar styles
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    color: '#007AFF',
    fontSize: 12,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  // Downloaded models header styles
  downloadedHeader: {
    marginBottom: 16,
  },
  storageInfo: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  // Parameter configuration modal styles
  parameterConfigContainer: {
    flex: 1,
    padding: 16,
  },
  parameterSection: {
    marginBottom: 24,
  },
  parameterSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  parameterRow: {
    marginBottom: 16,
  },
  parameterLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  parameterDescription: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  parameterInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },
  stopSequenceInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  parameterButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
    gap: 12,
  },
  resetButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Download status labels
  pausedLabel: {
    color: '#ff9500',
    fontSize: 12,
    fontWeight: 'bold',
  },
  failedLabel: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Download control buttons
  pauseButton: {
    backgroundColor: '#ff9500',
  },
  resumeButton: {
    backgroundColor: '#34C759',
  },
  retryButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
  },
  downloadingText: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default AdvancedSettingsScreen; 