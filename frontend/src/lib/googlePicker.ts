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

let gapiLoadPromise: Promise<void> | null = null;

/**
 * Tải script Google API (api.js) một cách an toàn.
 * Sử dụng singleton promise để tránh nạp nhiều lần.
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
      console.log("[GooglePicker] GAPI script loaded successfully.");
      resolve();
    };
    s.onerror = (err) => {
      console.error("[GooglePicker] Failed to load GAPI script:", err);
      gapiLoadPromise = null;
      reject(new Error("Không tải được Google API script. Vui lòng kiểm tra kết nối hoặc chặn quảng cáo."));
    };
    document.body.appendChild(s);
  });

  return gapiLoadPromise;
}

/**
 * Mở Google Picker để chọn Spreadsheet.
 */
export async function pickGoogleSpreadsheet(
  accessToken: string,
  developerKey: string
): Promise<string | null> {
  try {
    await loadGapiScript();
  } catch (err) {
    throw err;
  }

  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("GAPI không tồn tại sau khi tải."));
      return;
    }

    console.log("[GooglePicker] Initializing 'picker' module...");
    window.gapi.load("picker", {
      callback: () => {
        console.log("[GooglePicker] 'picker' module callback triggered.");
        
        // Đôi khi google.picker mất một chút thời gian để gắn vào window sau callback
        let retries = 0;
        const checkPicker = () => {
          const google = window.google;
          if (google?.picker) {
            console.log("[GooglePicker] google.picker is ready.");
            try {
              const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.SPREADSHEETS)
                .setOAuthToken(accessToken)
                .setDeveloperKey(developerKey)
                .setCallback((data) => {
                  if (data.action === google.picker.Action.PICKED && data.docs?.[0]?.id) {
                    resolve(data.docs[0].id);
                    return;
                  }
                  if (data.action === google.picker.Action.CANCEL) {
                    resolve(null);
                  }
                })
                .build();
              picker.setVisible(true);
            } catch (err) {
              console.error("[GooglePicker] Error building picker:", err);
              reject(new Error("Lỗi khi khởi tạo giao diện chọn file."));
            }
          } else if (retries < 50) { // Thử lại trong tối đa 5 giây
            retries++;
            if (retries % 10 === 0) {
              console.warn(`[GooglePicker] google.picker not found, retrying... (${retries}/50)`);
            }
            setTimeout(checkPicker, 100);
          } else {
            reject(new Error("Không thể khởi tạo Google Picker (google.picker is missing). Vui lòng thử lại hoặc tải lại trang."));
          }
        };

        checkPicker();
      },
      onerror: () => {
        console.error("[GooglePicker] Failed to load 'picker' module.");
        reject(new Error("Lỗi khi tải module Google Picker từ máy chủ Google."));
      },
    });
  });
}
