# Акты ЦОБ г. Уфа — прототип
    pip install -r requirements.txt
    uvicorn main:app --reload
Откройте http://127.0.0.1:8000

- Распознавание — mock (`mock_ocr` в main.py), место для интеграции с Yandex Vision / Tesseract.
- Статьи КоАП РБ и пункты Правил благоустройства в `VIOLATIONS` — заглушки, их нужно заполнить по актуальным редакциям.
- База: `acts.db`, загруженные фото: `uploads/`.
