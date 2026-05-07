/** Google Picker (Spreadsheets) — cần GOOGLE_PICKER_API_KEY + OAuth token. */

declare global {
  interface Window {
    gapi?: {
      load: (
        api: string,
        opts: { callback: () => void; onerror?: (err: unknown) => void }
      ) => void;
    };
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { SPREADSHEETS: unknown };
        Action: { PICKED: string; CANCEL: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(
    cb: (data: { action: string; docs?: { id?: string }[] }) => void
  ): GooglePickerBuilder;
  build(): { setVisible: (v: boolean) => void };
}

export function loadGapiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Chỉ dùng trên trình duyệt."));
  }
  if (window.gapi?.load) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Không tải được Google API"));
    document.body.appendChild(s);
  });
}

export async function pickGoogleSpreadsheet(
  accessToken: string,
  developerKey: string
): Promise<string | null> {
  await loadGapiScript();
  const google = window.google;
  if (!google?.picker) {
    throw new Error("Google Picker chưa sẵn sàng.");
  }
  return new Promise((resolve) => {
    window.gapi!.load("picker", {
      callback: () => {
        const picker = new google.picker.PickerBuilder()
          .addView(google.picker.ViewId.SPREADSHEETS)
          .setOAuthToken(accessToken)
          .setDeveloperKey(developerKey)
          .setCallback((data) => {
            if (
              data.action === google.picker.Action.PICKED &&
              data.docs?.[0]?.id
            ) {
              resolve(data.docs[0].id!);
              return;
            }
            resolve(null);
          })
          .build();
        picker.setVisible(true);
      },
    });
  });
}
