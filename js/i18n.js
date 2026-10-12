// Vietnamese is the default; English is a toggle remembered per browser.
const dict = {
  vi: {
    'meta.title': 'RedSun Villa — Villa 4 tầng có phòng xông hơi',
    'nav.floors': 'Các tầng', 'nav.amenities': 'Tiện ích', 'nav.availability': 'Lịch trống', 'nav.contact': 'Liên hệ', 'nav.book': 'Đặt phòng',
    'nav.menu': 'Mở menu', 'nav.lang': 'Đổi ngôn ngữ',

    'hero.eyebrow': 'Villa nghỉ dưỡng · 4 tầng · Phòng xông hơi',
    'hero.title1': 'Một ngôi nhà,', 'hero.title2': 'bốn tầng nắng.',
    'hero.lead': 'Thuê từng phòng cho chuyến đi nhỏ, hoặc trọn căn villa cho cả gia đình và nhóm bạn — có phòng xông hơi và bếp chung.',
    'search.mode': 'Hình thức thuê', 'search.mode.room': 'Chọn phòng', 'search.mode.villa': 'Nguyên căn',
    'search.checkin': 'Nhận phòng', 'search.checkout': 'Trả phòng', 'search.adults': 'Người lớn', 'search.children': 'Trẻ em',
    'search.cta': 'Xem giá & phòng trống', 'search.guests': 'Khách', 'guests.less': 'Bớt', 'guests.more': 'Thêm', 'guests.note': 'Tối đa {n} khách khi thuê nguyên căn.',
    'fact.floors': '4 tầng', 'fact.rooms': '5 phòng', 'fact.guests': 'Tối đa 18 khách', 'fact.sauna': 'Phòng xông hơi',

    'floors.eyebrow': 'Bên trong RedSun', 'floors.title': 'Mỗi tầng, một cách ở.', 'floors.lead': 'Chọn một tầng để xem các phòng.',
    'floor.label': 'Tầng {n}', 'floor.picker': 'Chọn tầng',
    'floor.1.title': 'Sinh hoạt chung & bếp',
    'floor.1.desc': 'Không gian chung để mọi người quây quần: phòng sinh hoạt và bếp nấu, dùng chung cho tất cả khách lưu trú.',
    'floor.2.title': 'Phòng khép kín & căn hộ',
    'floor.2.desc': 'Một phòng khép kín và một căn hộ có bếp nấu riêng. Tiêu chuẩn mỗi phòng: 2 người lớn + 1 trẻ em.',
    'floor.3.title': 'Phòng khép kín & căn hộ',
    'floor.3.desc': 'Một phòng khép kín và một căn hộ có bếp nấu riêng. Tiêu chuẩn mỗi phòng: 2 người lớn + 1 trẻ em.',
    'floor.4.title': 'Phòng Dorm',
    'floor.4.desc': 'Phòng tập thể trên tầng cao nhất, ở được 6 người — hợp cho nhóm bạn đi cùng nhau.',
    'floor.1.short': 'Sinh hoạt · Bếp', 'floor.2.short': 'Phòng · Căn hộ', 'floor.3.short': 'Phòng · Căn hộ', 'floor.4.short': 'Dorm 6 người',
    'floor.shared': 'Dùng chung cho mọi khách', 'floor.shared.living': 'Phòng sinh hoạt chung', 'floor.shared.kitchen': 'Bếp nấu chung',

    'unit.kind.room': 'Phòng khép kín', 'unit.kind.apartment': 'Căn hộ có bếp', 'unit.kind.dorm': 'Phòng Dorm',
    'unit.name': '{code} · {kind}',
    'unit.cap': '{adults} người lớn + {children} trẻ em', 'unit.capDorm': 'Ở được {adults} người',
    'unit.from': 'Từ {price} / đêm', 'unit.perNight': '/ đêm',
    'unit.feat.bath': 'Phòng tắm riêng', 'unit.feat.kitchen': 'Bếp nấu riêng', 'unit.feat.group': 'Hợp cho nhóm',
    'unit.choose': 'Chọn phòng này',

    'amen.eyebrow': 'Dùng chung', 'amen.title': 'Tiện ích trong villa', 'amen.lead': 'Những không gian mọi khách lưu trú đều được dùng.',
    'amen.sauna': 'Phòng xông hơi', 'amen.sauna.d': 'Thư giãn sau một ngày dài.',
    'amen.kitchen': 'Bếp chung', 'amen.kitchen.d': 'Ở tầng 1, nấu nướng cho cả nhóm.',
    'amen.living': 'Phòng sinh hoạt chung', 'amen.living.d': 'Chỗ quây quần ở tầng 1.',
    'amen.kitchenette': 'Bếp riêng trong căn hộ', 'amen.kitchenette.d': 'Có ở căn hộ tầng 2 và tầng 3.',
    'amen.villaFrom': 'Thuê nguyên căn từ {price} / đêm',
    'nav.around': 'Xung quanh', 'around.more': 'Xem tất cả {n} ảnh', 'around.eyebrow': 'Xung quanh', 'around.title': 'Cảnh quanh villa', 'around.lead': 'Cuộn xuống để đi một vòng quanh villa.',
    'lb.close': 'Đóng', 'lb.prev': 'Ảnh trước', 'lb.next': 'Ảnh sau', 'lb.open': 'Xem ảnh {i} lớn hơn',

    'avail.eyebrow': 'Lịch phòng', 'avail.title': 'Xem phòng trống',
    'avail.lead': 'Xem phòng còn trống và giá từng đêm, theo tháng, tuần hoặc ngày.',
    'cal.free': 'Trống', 'cal.few': 'Còn ít phòng', 'cal.none': 'Hết', 'cal.from': 'từ {price}', 'cal.fromWord': 'từ',
    'cal.how.month': 'Bấm ngày nhận phòng, rồi bấm ngày trả phòng. Giá là giá thấp nhất mỗi đêm.',
    'cal.how.week': 'Ở hàng của phòng bạn muốn: bấm đêm đầu, rồi bấm đêm cuối.',
    'cal.how.day': 'Các phòng trong đêm đã chọn. Bấm Đặt để đặt 1 đêm, sửa số đêm ở bước sau.',
    'cal.pickedWeek': '{room}: đêm đầu {date} — bấm đêm cuối cùng hàng.',
    'cal.freeAgain': 'Trống lại từ {date}', 'cal.fullAhead': 'Kín trong 30 ngày tới', 'cal.goThere': 'Xem ngày đó',
    'cal.villaSub': 'Cả 5 phòng đều trống — thuê trọn căn',
    'avail.view': 'Kiểu xem', 'avail.view.day': 'Ngày', 'avail.view.week': 'Tuần', 'avail.view.month': 'Tháng',
    'avail.today': 'Hôm nay', 'avail.prev': 'Trước', 'avail.next': 'Sau',
    'avail.loading': 'Đang tải lịch…', 'avail.error': 'Không tải được lịch.', 'avail.retry': 'Thử lại',
    'avail.room': 'Phòng', 'avail.book': 'Đặt', 'avail.nightOf': 'Đêm {date}',
    'avail.pickedIn': 'Nhận phòng {date} — chọn ngày trả phòng.',
    'state.free': 'Còn trống', 'state.held': 'Đang giữ chỗ', 'state.booked': 'Đã đặt', 'state.blocked': 'Tạm đóng', 'state.past': 'Đã qua',
    'villa.free': 'Trống cả căn', 'villa.partial': 'Còn {n}/5', 'villa.full': 'Hết phòng', 'villa.left': 'Còn {n}/{total} phòng',
    'villa.legend.free': 'Trống cả căn', 'villa.legend.partial': 'Còn một số phòng', 'villa.legend.full': 'Hết phòng', 'villa.legend.hover': 'Rê chuột hoặc chạm vào ngày để xem phòng còn trống.', 'avail.freeRooms': 'Còn trống: {rooms}',

    'book.eyebrow': 'Đặt phòng', 'book.title': 'Đặt phòng trong vài bước.',
    'book.step1': 'Ngày & phòng', 'book.step2': 'Thông tin & thanh toán',
    'book.villaInfo': 'Bạn có trọn 5 phòng, khu sinh hoạt chung, bếp và phòng xông hơi — tối đa 18 khách (14 người lớn).',
    'book.rooms': 'Chọn phòng', 'book.pickDates': 'Chọn ngày để xem phòng nào còn trống.',
    'book.unitFree': 'Còn trống', 'book.unitTaken': 'Đã kín ngày này',
    'book.promo': 'Mã ưu đãi', 'book.promoPh': 'Nhập mã', 'book.apply': 'Áp dụng', 'book.remove': 'Bỏ mã',
    'book.continue': 'Tiếp tục', 'book.back': 'Sửa ngày & phòng',
    'book.name': 'Họ và tên', 'book.phone': 'Số điện thoại', 'book.email': 'Email', 'book.optional': 'không bắt buộc', 'book.note': 'Ghi chú cho chủ nhà',
    'book.payMode': 'Số tiền thanh toán', 'book.deposit': 'Đặt cọc {pct}%', 'book.depositHint': 'Phần còn lại trả khi nhận phòng',
    'book.full': 'Thanh toán toàn bộ', 'book.fullHint': 'Không phải trả thêm khi đến',
    'book.method': 'Phương thức thanh toán',
    'pay.vietqr': 'Chuyển khoản VietQR', 'pay.vietqr.d': 'Quét mã bằng app ngân hàng',
    'pay.vnpay': 'VNPay', 'pay.vnpay.d': 'Thẻ ATM nội địa, QR ngân hàng',
    'pay.momo': 'Ví MoMo', 'pay.momo.d': 'Thanh toán bằng ví MoMo',
    'pay.stripe': 'Thẻ quốc tế', 'pay.stripe.d': 'Visa, Mastercard, Amex',
    'pay.demo': 'Demo', 'pay.off': 'Chưa bật', 'pay.admin': 'Chủ nhà đặt hộ',
    'dp.add': 'Chọn ngày', 'dp.pickIn': 'Chọn ngày nhận phòng', 'dp.pickOut': 'Chọn ngày trả phòng', 'dp.clear': 'Xoá ngày', 'dp.done': 'Xong', 'dp.full': 'Hết phòng', 'dp.partial': 'Còn một số phòng', 'dp.prevMonth': 'Tháng trước', 'dp.nextMonth': 'Tháng sau',
    'gallery.photo': 'Ảnh {i}/{n}', 'gallery.count': '{n} ảnh', 'gallery.label': 'Ảnh {name}',
    'book.agree': 'Tôi đồng ý giữ chỗ và thanh toán theo thông tin trên.',
    'book.pay': 'Thanh toán {amount}', 'book.paying': 'Đang tạo thanh toán…',

    'sum.title': 'Chuyến đi của bạn', 'sum.empty': 'Chọn ngày và phòng để xem giá.',
    'sum.nights': '{n} đêm', 'sum.guests': '{a} người lớn · {c} trẻ em', 'sum.villa': 'Nguyên căn villa',
    'sum.perNight': '{n} đêm × trung bình {avg}', 'sum.weekendNote': 'Đêm thứ Sáu, thứ Bảy tính giá cuối tuần.',
    'sum.special': 'Có ngày áp dụng giá lễ/Tết.',
    'sum.subtotal': 'Tạm tính', 'sum.promo': 'Mã {code}', 'sum.total': 'Tổng cộng',
    'sum.dueNow': 'Thanh toán bây giờ', 'sum.dueLater': 'Trả khi nhận phòng',
    'sum.hold': 'Phòng được giữ {min} phút sau khi bạn bấm thanh toán.',
    'sum.loading': 'Đang tính giá…',

    'contact.eyebrow': 'Liên hệ', 'contact.title': 'Hỏi gì cũng được.',
    'contact.lead': 'Gọi điện hoặc nhắn Facebook cho chủ nhà nếu bạn cần tư vấn trước khi đặt.',
    'contact.phone': 'Điện thoại', 'contact.openMap': 'Mở Google Maps', 'contact.zalo': 'Zalo', 'contact.facebook': 'Facebook', 'contact.email': 'Email', 'contact.address': 'Địa chỉ',
    'contact.checkin': 'Nhận phòng từ {time}', 'contact.checkout': 'Trả phòng trước {time}',
    'footer.rights': 'RedSun Villa', 'footer.top': 'Lên đầu trang', 'footer.staff': 'Nhân viên',

    'st.title': 'Đặt phòng {ref}', 'st.loading': 'Đang tải…', 'st.notFound': 'Không tìm thấy mã đặt phòng này.',
    'st.pending': 'Chờ thanh toán', 'st.confirmed': 'Đã xác nhận', 'st.deposit_paid': 'Đã đặt cọc', 'st.paid': 'Đã thanh toán', 'st.cancelled': 'Đã huỷ', 'st.expired': 'Hết hạn giữ chỗ', 'st.needs_refund': 'Cần hoàn tiền',
    'st.pending.d': 'Phòng đang được giữ cho bạn đến {time}. Hoàn tất thanh toán để xác nhận.',
    'st.deposit_paid.d': 'Đặt phòng đã được xác nhận. Còn lại {amount} thanh toán khi nhận phòng.',
    'st.confirmed.d': 'Đặt phòng đã được chủ nhà xác nhận. Thanh toán {amount} khi nhận phòng.',
    'st.paid.d': 'Đặt phòng đã được xác nhận và thanh toán đầy đủ. Hẹn gặp bạn!',
    'st.cancelled.d': 'Đặt phòng này đã bị huỷ. Liên hệ chủ nhà nếu cần hỗ trợ.',
    'st.expired.d': 'Thời gian giữ chỗ đã hết trước khi nhận được thanh toán. Bạn có thể đặt lại.',
    'st.needs_refund.d': 'Chúng tôi đã nhận tiền nhưng phòng không còn trống. Chủ nhà sẽ liên hệ để hoàn tiền.',
    'st.failed': 'Thanh toán chưa thành công. Bạn có thể thử lại hoặc chọn cách khác.',
    'st.stay': 'Lưu trú', 'st.rooms': 'Phòng', 'st.guests': 'Khách', 'st.paidSoFar': 'Đã thanh toán', 'st.balance': 'Còn lại',
    'st.qr.title': 'Chuyển khoản để xác nhận', 'st.qr.bank': 'Ngân hàng', 'st.qr.account': 'Số tài khoản', 'st.qr.name': 'Chủ tài khoản',
    'st.qr.amount': 'Số tiền', 'st.qr.note': 'Nội dung chuyển khoản', 'st.qr.copy': 'Sao chép', 'st.qr.copied': 'Đã sao chép',
    'st.qr.wait': 'Chủ nhà sẽ xác nhận ngay khi nhận được tiền. Trang này tự cập nhật.',
    'st.qr.demo': 'Chế độ demo: chưa cấu hình tài khoản ngân hàng. Đừng chuyển tiền thật.',
    'st.otherMethod': 'Hoặc thanh toán bằng cách khác', 'st.newBooking': 'Đặt phòng mới', 'st.home': 'Về trang chủ',
    'st.keepRef': 'Lưu lại mã đặt phòng để tra cứu: ',

    'err.generic': 'Có lỗi xảy ra. Vui lòng thử lại.', 'err.network': 'Mất kết nối. Kiểm tra mạng và thử lại.',
    'err.invalid_dates': 'Ngày không hợp lệ.', 'err.date_in_past': 'Ngày nhận phòng đã qua.', 'err.checkout_before_checkin': 'Ngày trả phòng phải sau ngày nhận phòng.',
    'err.too_many_nights': 'Tối đa {max} đêm mỗi lần đặt.', 'err.too_far_ahead': 'Chỉ nhận đặt trước tối đa {max} ngày.',
    'err.invalid_guests': 'Số khách không hợp lệ.', 'err.select_rooms': 'Chọn ít nhất một phòng.',
    'err.over_capacity': 'Quá sức chứa: tối đa {maxAdults} người lớn, {maxGuests} khách. Chọn thêm phòng hoặc thuê nguyên căn.',
    'err.unavailable': 'Phòng đã có người đặt trong khoảng ngày này. Chọn ngày hoặc phòng khác.',
    'err.promo_invalid': 'Mã ưu đãi không đúng.', 'err.promo_expired': 'Mã ưu đãi đã hết hạn.', 'err.promo_min_nights': 'Mã này cần ở tối thiểu {min} đêm.',
    'err.promo_not_applicable': 'Mã này không áp dụng cho hình thức thuê đã chọn.', 'err.promo_used_up': 'Mã ưu đãi đã hết lượt dùng.',
    'err.invalid_name': 'Nhập họ tên (ít nhất 2 ký tự).', 'err.invalid_phone': 'Số điện thoại không hợp lệ.', 'err.invalid_email': 'Email không hợp lệ.',
    'err.note_too_long': 'Ghi chú tối đa 500 ký tự.', 'err.invalid_provider': 'Chọn phương thức thanh toán.', 'err.agree': 'Vui lòng xác nhận để tiếp tục.',
    'err.provider_unavailable': 'Cổng thanh toán đang lỗi. Phòng vẫn được giữ — thử lại hoặc chọn cách khác.', 'err.not_payable': 'Đặt phòng này không còn chờ thanh toán.',
    'ad.title': 'Quản trị', 'ad.login': 'Đăng nhập quản trị', 'ad.password': 'Mật khẩu', 'ad.signIn': 'Đăng nhập', 'ad.signOut': 'Đăng xuất',
    'ad.wrong_password': 'Sai mật khẩu.', 'ad.too_many_attempts': 'Thử quá nhiều lần. Đợi 15 phút.', 'ad.admin_not_configured': 'Chưa đặt ADMIN_PASSWORD trong .env.',
    'ad.tab.bookings': 'Đặt phòng', 'ad.tab.calendar': 'Lịch & đóng phòng', 'ad.tab.rates': 'Giá', 'ad.tab.promos': 'Ưu đãi',
    'ad.sum.arrivals': 'Khách đến hôm nay', 'ad.sum.inHouse': 'Đang lưu trú', 'ad.sum.pending': 'Chờ thanh toán', 'ad.sum.collected': 'Đã thu tháng này', 'ad.sum.refund': 'Cần hoàn tiền',
    'ad.search': 'Tìm mã, tên, SĐT, email', 'ad.allStatus': 'Mọi trạng thái', 'ad.upcoming': 'Chỉ sắp tới', 'ad.none': 'Không có đặt phòng nào.',
    'ad.col.ref': 'Mã', 'ad.col.guest': 'Khách', 'ad.col.stay': 'Lưu trú', 'ad.col.rooms': 'Phòng', 'ad.col.total': 'Tổng', 'ad.col.paid': 'Đã thu', 'ad.col.status': 'Trạng thái', 'ad.col.actions': 'Thao tác',
    'ad.confirmTransfer': 'Xác nhận đã nhận {amount}', 'ad.collectRest': 'Thu nốt {amount}', 'ad.cancel': 'Huỷ', 'ad.confirmCancel': 'Huỷ đặt phòng {ref}? Phòng sẽ được mở lại.',
    'ad.confirmPay': 'Ghi nhận đã nhận {amount} cho {ref}?', 'ad.method.vietqr': 'VietQR', 'ad.method.cash': 'Tiền mặt',
    'ad.block.title': 'Đóng phòng', 'ad.block.target': 'Phòng', 'ad.block.all': 'Toàn bộ villa', 'ad.block.from': 'Từ đêm', 'ad.block.to': 'Đến đêm', 'ad.block.reason': 'Lý do', 'ad.block.add': 'Đóng phòng', 'ad.block.remove': 'Mở lại',
    'ad.block.list': 'Đang đóng', 'ad.block.none': 'Không có ngày nào bị đóng.',
    'ad.rates.title': 'Giá mỗi đêm', 'ad.rates.target': 'Hạng', 'ad.rates.base': 'Ngày thường', 'ad.rates.weekend': 'Cuối tuần (T6, T7)', 'ad.save': 'Lưu', 'ad.saved': 'Đã lưu',
    'ad.special.title': 'Giá lễ / Tết', 'ad.special.lead': 'Điền giá cố định hoặc hệ số nhân (ví dụ 1.5). Áp dụng cho các đêm trong khoảng.', 'ad.special.price': 'Giá cố định', 'ad.special.mult': 'Hệ số', 'ad.special.label': 'Tên dịp', 'ad.special.add': 'Thêm', 'ad.special.none': 'Chưa có giá đặc biệt.', 'ad.allUnits': 'Mọi phòng & nguyên căn',
    'ad.promo.title': 'Mã ưu đãi', 'ad.promo.code': 'Mã', 'ad.promo.type': 'Loại', 'ad.promo.percent': 'Phần trăm', 'ad.promo.fixed': 'Số tiền', 'ad.promo.value': 'Giá trị', 'ad.promo.minNights': 'Tối thiểu đêm',
    'ad.promo.from': 'Từ ngày', 'ad.promo.to': 'Đến ngày', 'ad.promo.maxUses': 'Số lượt tối đa', 'ad.promo.appliesTo': 'Áp dụng cho', 'ad.promo.all': 'Tất cả', 'ad.promo.room': 'Thuê phòng', 'ad.promo.villa': 'Nguyên căn',
    'ad.promo.used': 'Đã dùng', 'ad.promo.active': 'Đang bật', 'ad.promo.add': 'Tạo mã', 'ad.promo.delete': 'Xoá', 'ad.promo.on': 'Bật', 'ad.promo.off': 'Tắt', 'ad.promo.code_exists': 'Mã đã tồn tại.', 'ad.promo.invalid_code': 'Mã chỉ gồm chữ, số, - và _ (3–30 ký tự).',
    'ad.rules.title': 'Giảm giá tự động', 'ad.rules.lead': 'Chỉ áp dụng mức giảm tốt nhất; mã ưu đãi được trừ thêm sau đó.', 'ad.rules.long_stay': 'Từ {n} đêm', 'ad.rules.early_bird': 'Đặt trước {n} ngày', 'ad.rules.threshold': 'Ngưỡng', 'ad.rules.percent': '% giảm',
    'ad.villa': 'Nguyên căn', 'ad.any': 'Không giới hạn', 'ad.error': 'Lỗi: {code}',
    'ad.new': '+ Tạo đặt phòng', 'ad.new.title': 'Đặt phòng cho khách', 'ad.new.lead': 'Cho khách gọi điện, nhắn Facebook hoặc đến trực tiếp. Mã ưu đãi dùng chung với khách tự đặt.',
    'ad.new.collected': 'Đã thu', 'ad.new.none': 'Chưa thu (trả khi đến)', 'ad.new.deposit': 'Đã thu cọc {pct}%', 'ad.new.full': 'Đã thu đủ', 'ad.new.method': 'Hình thức thu',
    'ad.method.transfer': 'Chuyển khoản', 'ad.method.card_onsite': 'Quẹt thẻ', 'ad.new.submit': 'Tạo đặt phòng', 'ad.new.close': 'Đóng', 'ad.new.created': 'Đã tạo đặt phòng {ref}',
    'ad.collect': 'Thu {amount}',
  },
  en: {
    'meta.title': 'RedSun Villa — A four-floor villa with a sauna',
    'nav.floors': 'Floors', 'nav.amenities': 'Amenities', 'nav.availability': 'Availability', 'nav.contact': 'Contact', 'nav.book': 'Book now',
    'nav.menu': 'Open menu', 'nav.lang': 'Change language',

    'hero.eyebrow': 'Private villa · 4 floors · Sauna',
    'hero.title1': 'One house,', 'hero.title2': 'four floors of sun.',
    'hero.lead': 'Rent a single room for a short trip, or the whole villa for family and friends — with a sauna and a shared kitchen.',
    'search.mode': 'Booking type', 'search.mode.room': 'Rooms', 'search.mode.villa': 'Whole villa',
    'search.checkin': 'Check-in', 'search.checkout': 'Check-out', 'search.adults': 'Adults', 'search.children': 'Children',
    'search.cta': 'Check price & availability', 'search.guests': 'Guests', 'guests.less': 'Fewer', 'guests.more': 'More', 'guests.note': 'Up to {n} guests for the whole villa.',
    'fact.floors': '4 floors', 'fact.rooms': '5 rooms', 'fact.guests': 'Up to 18 guests', 'fact.sauna': 'Sauna',

    'floors.eyebrow': 'Inside RedSun', 'floors.title': 'Each floor, its own way to stay.', 'floors.lead': 'Pick a floor to see its rooms.',
    'floor.label': 'Floor {n}', 'floor.picker': 'Choose a floor',
    'floor.1.title': 'Shared living & kitchen',
    'floor.1.desc': 'A shared space for everyone to gather: a living area and a kitchen, open to every guest.',
    'floor.2.title': 'En-suite room & apartment',
    'floor.2.desc': 'One en-suite room and one apartment with its own kitchenette. Each takes 2 adults + 1 child.',
    'floor.3.title': 'En-suite room & apartment',
    'floor.3.desc': 'One en-suite room and one apartment with its own kitchenette. Each takes 2 adults + 1 child.',
    'floor.4.title': 'Dorm room',
    'floor.4.desc': 'A shared room on the top floor that sleeps 6 — made for groups travelling together.',
    'floor.1.short': 'Living · Kitchen', 'floor.2.short': 'Room · Apartment', 'floor.3.short': 'Room · Apartment', 'floor.4.short': 'Dorm for 6',
    'floor.shared': 'Shared by all guests', 'floor.shared.living': 'Shared living area', 'floor.shared.kitchen': 'Shared kitchen',

    'unit.kind.room': 'En-suite room', 'unit.kind.apartment': 'Apartment with kitchenette', 'unit.kind.dorm': 'Dorm room',
    'unit.name': '{code} · {kind}',
    'unit.cap': '{adults} adults + {children} child', 'unit.capDorm': 'Sleeps {adults}',
    'unit.from': 'From {price} / night', 'unit.perNight': '/ night',
    'unit.feat.bath': 'Private bathroom', 'unit.feat.kitchen': 'Own kitchenette', 'unit.feat.group': 'Great for groups',
    'unit.choose': 'Choose this room',

    'amen.eyebrow': 'Shared', 'amen.title': 'Shared amenities', 'amen.lead': 'Spaces every guest gets to use.',
    'amen.sauna': 'Sauna', 'amen.sauna.d': 'Unwind after a long day.',
    'amen.kitchen': 'Shared kitchen', 'amen.kitchen.d': 'On floor 1, for cooking together.',
    'amen.living': 'Shared living area', 'amen.living.d': 'Room for the whole group on floor 1.',
    'amen.kitchenette': 'Apartment kitchenettes', 'amen.kitchenette.d': 'In the apartments on floors 2 and 3.',
    'amen.villaFrom': 'Whole villa from {price} / night',
    'nav.around': 'Surroundings', 'around.more': 'See all {n} photos', 'around.eyebrow': 'Surroundings', 'around.title': 'Around the villa', 'around.lead': 'Scroll to take a walk around the villa.',
    'lb.close': 'Close', 'lb.prev': 'Previous photo', 'lb.next': 'Next photo', 'lb.open': 'View photo {i} larger',

    'avail.eyebrow': 'Calendar', 'avail.title': 'See what’s open',
    'avail.lead': 'See free rooms and nightly prices by month, week or day.',
    'cal.free': 'Free', 'cal.few': 'Few rooms left', 'cal.none': 'Full', 'cal.from': 'from {price}', 'cal.fromWord': 'from',
    'cal.how.month': 'Tap your check-in day, then your check-out day. Prices are the lowest per night.',
    'cal.how.week': 'On the row of the room you want: tap the first night, then the last night.',
    'cal.how.day': 'Rooms for the chosen night. Book picks 1 night; change the nights in the next step.',
    'cal.pickedWeek': '{room}: first night {date} — now tap the last night on the same row.',
    'cal.freeAgain': 'Free again from {date}', 'cal.fullAhead': 'Booked for the next 30 days', 'cal.goThere': 'Go to that day',
    'cal.villaSub': 'All 5 rooms are free — rent the whole place',
    'avail.view': 'View', 'avail.view.day': 'Day', 'avail.view.week': 'Week', 'avail.view.month': 'Month',
    'avail.today': 'Today', 'avail.prev': 'Previous', 'avail.next': 'Next',
    'avail.loading': 'Loading calendar…', 'avail.error': 'Couldn’t load the calendar.', 'avail.retry': 'Try again',
    'avail.room': 'Room', 'avail.book': 'Book', 'avail.nightOf': 'Night of {date}',
    'avail.pickedIn': 'Check-in {date} — now pick check-out.',
    'state.free': 'Available', 'state.held': 'On hold', 'state.booked': 'Booked', 'state.blocked': 'Closed', 'state.past': 'Past',
    'villa.free': 'Villa free', 'villa.partial': '{n}/5 free', 'villa.full': 'Fully booked', 'villa.left': '{n} of {total} left',
    'villa.legend.free': 'Whole villa free', 'villa.legend.partial': 'Some rooms left', 'villa.legend.full': 'Fully booked', 'villa.legend.hover': 'Hover or tap a day to see which rooms are left.', 'avail.freeRooms': 'Free: {rooms}',

    'book.eyebrow': 'Booking', 'book.title': 'Book in a few steps.',
    'book.step1': 'Dates & rooms', 'book.step2': 'Details & payment',
    'book.villaInfo': 'You get all 5 rooms, the shared living area, kitchen and sauna — up to 18 guests (14 adults).',
    'book.rooms': 'Choose rooms', 'book.pickDates': 'Pick dates to see which rooms are free.',
    'book.unitFree': 'Available', 'book.unitTaken': 'Taken on these dates',
    'book.promo': 'Promo code', 'book.promoPh': 'Enter code', 'book.apply': 'Apply', 'book.remove': 'Remove',
    'book.continue': 'Continue', 'book.back': 'Edit dates & rooms',
    'book.name': 'Full name', 'book.phone': 'Phone', 'book.email': 'Email', 'book.optional': 'optional', 'book.note': 'Note to the host',
    'book.payMode': 'How much to pay now', 'book.deposit': '{pct}% deposit', 'book.depositHint': 'Pay the rest at check-in',
    'book.full': 'Pay in full', 'book.fullHint': 'Nothing more to pay on arrival',
    'book.method': 'Payment method',
    'pay.vietqr': 'VietQR bank transfer', 'pay.vietqr.d': 'Scan with any Vietnamese banking app',
    'pay.vnpay': 'VNPay', 'pay.vnpay.d': 'Local ATM cards, bank QR',
    'pay.momo': 'MoMo wallet', 'pay.momo.d': 'Pay with the MoMo app',
    'pay.stripe': 'International card', 'pay.stripe.d': 'Visa, Mastercard, Amex',
    'pay.demo': 'Demo', 'pay.off': 'Not enabled', 'pay.admin': 'Booked by host',
    'dp.add': 'Add date', 'dp.pickIn': 'Select check-in date', 'dp.pickOut': 'Select check-out date', 'dp.clear': 'Clear dates', 'dp.done': 'Done', 'dp.full': 'Fully booked', 'dp.partial': 'Some rooms left', 'dp.prevMonth': 'Previous month', 'dp.nextMonth': 'Next month',
    'gallery.photo': 'Photo {i} of {n}', 'gallery.count': '{n} photos', 'gallery.label': 'Photos of {name}',
    'book.agree': 'I agree to hold these dates and pay as shown.',
    'book.pay': 'Pay {amount}', 'book.paying': 'Creating payment…',

    'sum.title': 'Your stay', 'sum.empty': 'Choose dates and rooms to see the price.',
    'sum.nights': '{n} nights', 'sum.guests': '{a} adults · {c} children', 'sum.villa': 'Whole villa',
    'sum.perNight': '{n} nights × avg {avg}', 'sum.weekendNote': 'Friday and Saturday nights use weekend rates.',
    'sum.special': 'Includes holiday-rate nights.',
    'sum.subtotal': 'Subtotal', 'sum.promo': 'Code {code}', 'sum.total': 'Total',
    'sum.dueNow': 'Due now', 'sum.dueLater': 'Due at check-in',
    'sum.hold': 'Your rooms are held for {min} minutes once you continue to payment.',
    'sum.loading': 'Calculating…',

    'contact.eyebrow': 'Contact', 'contact.title': 'Ask us anything.',
    'contact.lead': 'Call or message the host on Facebook if you’d like help before booking.',
    'contact.phone': 'Phone', 'contact.openMap': 'Open in Google Maps', 'contact.zalo': 'Zalo', 'contact.facebook': 'Facebook', 'contact.email': 'Email', 'contact.address': 'Address',
    'contact.checkin': 'Check-in from {time}', 'contact.checkout': 'Check-out by {time}',
    'footer.rights': 'RedSun Villa', 'footer.top': 'Back to top', 'footer.staff': 'Staff',

    'st.title': 'Booking {ref}', 'st.loading': 'Loading…', 'st.notFound': 'We couldn’t find this booking.',
    'st.pending': 'Awaiting payment', 'st.confirmed': 'Confirmed', 'st.deposit_paid': 'Deposit paid', 'st.paid': 'Paid', 'st.cancelled': 'Cancelled', 'st.expired': 'Hold expired', 'st.needs_refund': 'Refund needed',
    'st.pending.d': 'Your rooms are held until {time}. Complete payment to confirm.',
    'st.deposit_paid.d': 'Your booking is confirmed. The remaining {amount} is due at check-in.',
    'st.confirmed.d': 'The host has confirmed your booking. {amount} is due at check-in.',
    'st.paid.d': 'Your booking is confirmed and fully paid. See you soon!',
    'st.cancelled.d': 'This booking was cancelled. Contact the host if you need help.',
    'st.expired.d': 'The hold ran out before payment arrived. You can book again.',
    'st.needs_refund.d': 'We received your payment but the rooms are no longer free. The host will contact you about a refund.',
    'st.failed': 'Payment didn’t go through. Try again or choose another method.',
    'st.stay': 'Stay', 'st.rooms': 'Rooms', 'st.guests': 'Guests', 'st.paidSoFar': 'Paid', 'st.balance': 'Balance',
    'st.qr.title': 'Transfer to confirm', 'st.qr.bank': 'Bank', 'st.qr.account': 'Account number', 'st.qr.name': 'Account name',
    'st.qr.amount': 'Amount', 'st.qr.note': 'Transfer note', 'st.qr.copy': 'Copy', 'st.qr.copied': 'Copied',
    'st.qr.wait': 'The host confirms as soon as the money arrives. This page updates by itself.',
    'st.qr.demo': 'Demo mode: no bank account is configured. Do not send real money.',
    'st.otherMethod': 'Or pay another way', 'st.newBooking': 'New booking', 'st.home': 'Back to home',
    'st.keepRef': 'Keep your booking code to look it up later: ',

    'err.generic': 'Something went wrong. Please try again.', 'err.network': 'Connection lost. Check your network and try again.',
    'err.invalid_dates': 'Those dates aren’t valid.', 'err.date_in_past': 'Check-in is in the past.', 'err.checkout_before_checkin': 'Check-out must be after check-in.',
    'err.too_many_nights': 'Up to {max} nights per booking.', 'err.too_far_ahead': 'Bookings open up to {max} days ahead.',
    'err.invalid_guests': 'Check the number of guests.', 'err.select_rooms': 'Choose at least one room.',
    'err.over_capacity': 'Too many guests: up to {maxAdults} adults and {maxGuests} guests. Add a room or book the whole villa.',
    'err.unavailable': 'Those dates are already taken. Pick other dates or rooms.',
    'err.promo_invalid': 'That promo code isn’t valid.', 'err.promo_expired': 'That promo code has expired.', 'err.promo_min_nights': 'This code needs at least {min} nights.',
    'err.promo_not_applicable': 'This code doesn’t apply to this booking type.', 'err.promo_used_up': 'This code has been fully used.',
    'err.invalid_name': 'Enter your name (at least 2 characters).', 'err.invalid_phone': 'Enter a valid phone number.', 'err.invalid_email': 'Enter a valid email.',
    'err.note_too_long': 'Notes can be up to 500 characters.', 'err.invalid_provider': 'Choose a payment method.', 'err.agree': 'Please confirm to continue.',
    'err.provider_unavailable': 'The payment gateway had a problem. Your rooms are still held — retry or pick another method.', 'err.not_payable': 'This booking is no longer awaiting payment.',
    'ad.title': 'Admin', 'ad.login': 'Admin sign in', 'ad.password': 'Password', 'ad.signIn': 'Sign in', 'ad.signOut': 'Sign out',
    'ad.wrong_password': 'Wrong password.', 'ad.too_many_attempts': 'Too many attempts. Wait 15 minutes.', 'ad.admin_not_configured': 'ADMIN_PASSWORD is not set in .env.',
    'ad.tab.bookings': 'Bookings', 'ad.tab.calendar': 'Calendar & closures', 'ad.tab.rates': 'Rates', 'ad.tab.promos': 'Discounts',
    'ad.sum.arrivals': 'Arriving today', 'ad.sum.inHouse': 'In house', 'ad.sum.pending': 'Awaiting payment', 'ad.sum.collected': 'Collected this month', 'ad.sum.refund': 'Refund needed',
    'ad.search': 'Search code, name, phone, email', 'ad.allStatus': 'All statuses', 'ad.upcoming': 'Upcoming only', 'ad.none': 'No bookings.',
    'ad.col.ref': 'Code', 'ad.col.guest': 'Guest', 'ad.col.stay': 'Stay', 'ad.col.rooms': 'Rooms', 'ad.col.total': 'Total', 'ad.col.paid': 'Paid', 'ad.col.status': 'Status', 'ad.col.actions': 'Actions',
    'ad.confirmTransfer': 'Confirm {amount} received', 'ad.collectRest': 'Collect {amount}', 'ad.cancel': 'Cancel', 'ad.confirmCancel': 'Cancel booking {ref}? Its dates will reopen.',
    'ad.confirmPay': 'Record {amount} received for {ref}?', 'ad.method.vietqr': 'VietQR', 'ad.method.cash': 'Cash',
    'ad.block.title': 'Close dates', 'ad.block.target': 'Room', 'ad.block.all': 'Whole villa', 'ad.block.from': 'From night', 'ad.block.to': 'To night', 'ad.block.reason': 'Reason', 'ad.block.add': 'Close', 'ad.block.remove': 'Reopen',
    'ad.block.list': 'Closed dates', 'ad.block.none': 'Nothing is closed.',
    'ad.rates.title': 'Nightly rates', 'ad.rates.target': 'Unit', 'ad.rates.base': 'Weekday', 'ad.rates.weekend': 'Weekend (Fri, Sat)', 'ad.save': 'Save', 'ad.saved': 'Saved',
    'ad.special.title': 'Holiday / Tết rates', 'ad.special.lead': 'Enter a fixed price or a multiplier (e.g. 1.5). Applies to nights in the range.', 'ad.special.price': 'Fixed price', 'ad.special.mult': 'Multiplier', 'ad.special.label': 'Occasion', 'ad.special.add': 'Add', 'ad.special.none': 'No special rates yet.', 'ad.allUnits': 'All rooms & whole villa',
    'ad.promo.title': 'Promo codes', 'ad.promo.code': 'Code', 'ad.promo.type': 'Type', 'ad.promo.percent': 'Percent', 'ad.promo.fixed': 'Amount', 'ad.promo.value': 'Value', 'ad.promo.minNights': 'Min nights',
    'ad.promo.from': 'From', 'ad.promo.to': 'Until', 'ad.promo.maxUses': 'Max uses', 'ad.promo.appliesTo': 'Applies to', 'ad.promo.all': 'All', 'ad.promo.room': 'Rooms', 'ad.promo.villa': 'Whole villa',
    'ad.promo.used': 'Used', 'ad.promo.active': 'Active', 'ad.promo.add': 'Create code', 'ad.promo.delete': 'Delete', 'ad.promo.on': 'On', 'ad.promo.off': 'Off', 'ad.promo.code_exists': 'That code already exists.', 'ad.promo.invalid_code': 'Letters, digits, - and _ only (3–30 chars).',
    'ad.rules.title': 'Automatic discounts', 'ad.rules.lead': 'Only the best one applies; promo codes come off after it.', 'ad.rules.long_stay': '{n}+ nights', 'ad.rules.early_bird': 'Booked {n}+ days ahead', 'ad.rules.threshold': 'Threshold', 'ad.rules.percent': '% off',
    'ad.villa': 'Whole villa', 'ad.any': 'Unlimited', 'ad.error': 'Error: {code}',
    'ad.new': '+ New booking', 'ad.new.title': 'Book for a guest', 'ad.new.lead': 'For phone, Facebook or walk-in guests. Promo codes are the same ones guests use.',
    'ad.new.collected': 'Collected', 'ad.new.none': 'Nothing yet (pay on arrival)', 'ad.new.deposit': '{pct}% deposit collected', 'ad.new.full': 'Paid in full', 'ad.new.method': 'Collected by',
    'ad.method.transfer': 'Bank transfer', 'ad.method.card_onsite': 'Card on site', 'ad.new.submit': 'Create booking', 'ad.new.close': 'Close', 'ad.new.created': 'Booking {ref} created',
    'ad.collect': 'Collect {amount}',
  },
};

const KEY = 'rs_lang';
let lang = 'vi';
try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch { /* storage blocked */ }

export const getLang = () => lang;

/** Merge extra strings (e.g. the admin's) into both languages. */
export function addStrings(vi, en) {
  Object.assign(dict.vi, vi);
  Object.assign(dict.en, en);
}
export const locale = () => (lang === 'en' ? 'en-GB' : 'vi-VN');

export function t(key, vars = {}) {
  const raw = dict[lang][key] ?? dict.vi[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

/** Translate static markup: data-i18n="key" and data-i18n-attr="placeholder:key;aria-label:key". */
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
  document.querySelectorAll('[data-lang-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang)));
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'vi';
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
  applyI18n();
  document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
}

export function bindLangButtons() {
  document.querySelectorAll('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)));
}

export function errorText(code, details) {
  const key = `err.${code}`;
  return dict.vi[key] ? t(key, details ?? {}) : t('err.generic');
}
