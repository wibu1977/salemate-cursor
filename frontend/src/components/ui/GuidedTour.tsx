"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function GuidedTour() {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Chỉ chạy ở client side
    if (typeof window === "undefined") return;

    if (isInitialized.current) return;
    isInitialized.current = true;

    // Kiểm tra xem đã xem tour chưa
    const hasSeenTour = localStorage.getItem("salemate-tour-completed");
    if (hasSeenTour) return;

    // Đợi UI render xong
    const timer = setTimeout(() => {
      // Đảm bảo các element tồn tại trước khi chạy
      const fbLink = document.querySelector('a[href="/connect-facebook"]');
      if (!fbLink) return; // Đang ở trang không có sidebar

      const driverObj = driver({
        showProgress: true,
        animate: true,
        doneBtnText: "Hoàn thành",
        nextBtnText: "Tiếp theo",
        prevBtnText: "Quay lại",
        popoverClass: "salemate-driver-theme",
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || confirm("Bạn có chắc muốn bỏ qua hướng dẫn? (Bạn có thể xem lại trong khung chat Hỗ trợ)")) {
            localStorage.setItem("salemate-tour-completed", "true");
            driverObj.destroy();
          }
        },
        steps: [
          {
            popover: {
              title: "🎉 Chào mừng đến với Salemate!",
              description: "Cảm ơn bạn đã lựa chọn Salemate. Hãy cùng chúng tôi điểm qua 3 bước quan trọng nhất để thiết lập hệ thống bán hàng tự động nhé.",
            }
          },
          {
            element: 'a[href="/connect-facebook"]',
            popover: {
              title: "Bước 1: Kết nối Facebook",
              description: "Để AI của Salemate có thể nhận tin nhắn và tự động tư vấn, chốt đơn, bạn cần kết nối Fanpage tại đây.",
              side: "right",
              align: "start"
            }
          },
          {
            element: 'a[href="/dashboard/settings"]',
            popover: {
              title: "Bước 2: Thiết lập Toss Pay",
              description: "Để khách hàng có thể thanh toán trực tuyến, hãy vào Cài đặt để cấu hình API Key của Toss nhé.",
              side: "right",
              align: "start"
            }
          },
          {
            element: 'a[href="/dashboard/orders"]',
            popover: {
              title: "Bước 3: Quản lý Đơn hàng",
              description: "Khi AI chốt đơn thành công, tất cả đơn hàng sẽ tự động đổ về đây để bạn dễ dàng theo dõi và xử lý.",
              side: "right",
              align: "start"
            }
          }
        ]
      });

      driverObj.drive();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
