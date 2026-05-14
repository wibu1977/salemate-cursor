/** Google Picker (Spreadsheets) — needs GOOGLE_PICKER_API_KEY + OAuth token. */

export type GoogleSpreadsheetPick =
  | { id: string; name: string }
  | null;

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

interface PickerDoc {
  id?: string;
  name?: string;
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(
    cb: (data: { action: string; docs?: PickerDoc[] }) => void
  ): GooglePickerBuilder;
  build(): { setVisible: (v: boolean) => void };
}

let gapiLoadPromise: Promise<void> | null = null;

/**
 * Tải script Google API (api.js) một cách an toàn.
 */
export function loadGapiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Chỉ dùng trên trình duyệt."));
  }

  if (window.gapi?.load) {
    return Promise.resolve();
  }

  if (gapiLoadPromise) {
    return gapiLoadPromise;
  }

  gapiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => {
      resolve();
    };
    s.onerror = () => {
      gapiLoadPromise = null;
      reject(
        new Error(
          "Không tải được Google API script. Vui lòng kiểm tra kết nối hoặc trình chặn quảng cáo."
        )
      );
    };
    document.body.appendChild(s);
  });

  return gapiLoadPromise;
}

/**
 * Mở Google Picker để chọn Spreadsheet. Trả về id và tên file.
 */
export async function pickGoogleSpreadsheet(
  accessToken: string,
  developerKey: string
): Promise<GoogleSpreadsheetPick> {
  await loadGapiScript();

  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("GAPI không tồn tại sau khi tải."));
      return;
    }

    window.gapi.load("picker", {
      callback: () => {
        let retries = 0;
        const checkPicker = () => {
          const google = window.google;
          if (google?.picker) {
            try {
              const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.SPREADSHEETS)
                .setOAuthToken(accessToken)
                .setDeveloperKey(developerKey)
                .setCallback((data) => {
                  if (data.action === google.picker.Action.PICKED && data.docs?.[0]?.id) {
                    const doc = data.docs[0];
                    resolve({
                      id: doc.id!,
                      name: doc.name ?? doc.id!,
                    });
                    return;
                  }
                  if (data.action === google.picker.Action.CANCEL) {
                    resolve(null);
                  }
                })
                .build();
              picker.setVisible(true);
            } catch {
              reject(new Error("Lỗi khi khởi tạo giao diện chọn file."));
            }
          } else if (retries < 50) {
            retries++;
            setTimeout(checkPicker, 100);
          } else {
            reject(
              new Error(
                "Không thể khởi tạo Google Picker. Thử lại hoặc tải lại trang."
              )
            );
          }
        };

        checkPicker();
      },
      onerror: () =>
        reject(new Error("Lỗi khi tải module Google Picker từ máy chủ Google.")),
    });
  });
}
