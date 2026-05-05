import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

const ensureLocalFile = async (fileName: string, content: string) => {
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;

  if (!directory) {
    throw new Error("Direktori file tidak tersedia");
  }

  const fileUri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
};

export const saveCsvFile = async (fileName: string, csvContent: string) => {
  const content = "\uFEFF" + csvContent;

  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    return { mode: "downloaded" as const };
  }

  const localFileUri = await ensureLocalFile(fileName, content);

  if (Platform.OS === "android") {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (permissions.granted) {
      const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        "text/csv"
      );

      await FileSystem.writeAsStringAsync(targetUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return { mode: "saved" as const, uri: targetUri };
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localFileUri, {
      mimeType: "text/csv",
      dialogTitle: "Simpan file CSV",
      UTI: "public.comma-separated-values-text",
    });

    return { mode: "shared" as const, uri: localFileUri };
  }

  return { mode: "saved-locally" as const, uri: localFileUri };
};

export const saveImageToGallery = async (uri: string, albumName = "Presensi") => {
  const permission = await MediaLibrary.requestPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Izin galeri ditolak");
  }

  const asset = await MediaLibrary.createAssetAsync(uri);
  const album = await MediaLibrary.getAlbumAsync(albumName);

  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  } else {
    await MediaLibrary.createAlbumAsync(albumName, asset, false);
  }

  return asset;
};

export const writeBase64ImageToCache = async (fileName: string, base64Content: string) => {
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;

  if (!directory) {
    throw new Error("Direktori gambar tidak tersedia");
  }

  const fileUri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
};
