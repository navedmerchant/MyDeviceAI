import Toast from 'react-native-simple-toast';

export const showToast = (message: string, isLong: boolean = false) => {
  Toast.showWithGravity(message, isLong ? Toast.LONG : Toast.SHORT, Toast.CENTER);
};

export const showTopToast = (message: string) => {
  Toast.showWithGravity(message, Toast.SHORT, Toast.TOP);
};

export const showLongToast = (message: string) => {
  Toast.showWithGravity(message, Toast.LONG, Toast.CENTER);
};

export const showLongTopToast = (message: string) => {
  Toast.showWithGravity(message, Toast.LONG, Toast.TOP);
}; 