export const portalManifest = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: false,
  AppName: "EpicPortalApp",
  CatalogItemId: "portal-catalog-id",
  DisplayName: "Portal",
  InstallLocation: "C:\\Program Files\\Epic Games\\Portal",
  LaunchExecutable: "Portal\\Binaries\\Win64\\Portal.exe",
  AppVersionString: "1.0.0",
  InstallSize: 123456789,
});

export const fortniteManifest = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: false,
  AppName: "Fortnite",
  CatalogItemId: "fortnite-catalog-id",
  DisplayName: "Fortnite",
  InstallLocation: "D:\\Epic\\Fortnite",
  LaunchExecutable: "FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe",
});

export const absoluteExecutableManifest = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: false,
  AppName: "EpicRelocated",
  DisplayName: "Relocated",
  InstallLocation: "C:\\Games\\Relocated",
  LaunchExecutable: "D:\\Other\\relocated.exe",
});

export const incompleteManifest = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: true,
  AppName: "EpicIncomplete",
  DisplayName: "Incomplete",
  InstallLocation: "C:\\Games\\Incomplete",
});

export const duplicatePortalManifest = JSON.stringify({
  FormatVersion: 0,
  AppName: "EpicPortalApp",
  DisplayName: "Portal (duplicate)",
  InstallLocation: "E:\\Games\\Portal",
});
