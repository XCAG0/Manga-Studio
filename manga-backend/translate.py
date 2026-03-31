from deep_translator import GoogleTranslator
import time

class TranslationService:
    
    def __init__(self):
        self.cache = {}  
   
    def translate_text(self, text, source_lang='auto', target_lang='en'):

        if not text or len(text.strip()) == 0:
            return text
        
        cache_key = f"{source_lang}_{target_lang}_{text}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            translated = translator.translate(text)
            
            self.cache[cache_key] = translated
            
            return translated
        except Exception as e:
            print(f"[Translation] Error translating '{text[:30]}...': {e}")
            return text  
    
    
    def translate_bubbles(self, bubbles, source_lang='auto', target_lang='en'):

        if not bubbles:
            return []
        
        start_time = time.time()
        
        texts = [bubble.get('text', '') for bubble in bubbles]
        
        non_empty_indices = [i for i, text in enumerate(texts) if text and text.strip()]
        non_empty_texts = [texts[i] for i in non_empty_indices]
        
        if not non_empty_texts:
            return bubbles
        
        print(f"[Translation] Batch translating {len(non_empty_texts)} texts...")
        
        try:
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            translations = translator.translate_batch(non_empty_texts)
            
            translation_map = dict(zip(non_empty_indices, translations))
            
            for i, bubble in enumerate(bubbles):
                if i in translation_map:
                    translated = translation_map[i]
                    # Cache it
                    cache_key = f"{source_lang}_{target_lang}_{bubble['text']}"
                    self.cache[cache_key] = translated
                    bubble['original_text'] = bubble['text']
                    bubble['translated_text'] = translated
                else:
                    bubble['original_text'] = bubble.get('text', '')
                    bubble['translated_text'] = bubble.get('text', '')
            
            elapsed = time.time() - start_time
            print(f"[Translation] Batch completed in {elapsed:.2f}s")
            
        except Exception as e:
            print(f"[Translation] Batch failed: {e}, falling back to individual...")
            for bubble in bubbles:
                text = bubble.get('text', '')
                if text:
                    translated = self.translate_text(text, source_lang, target_lang)
                    bubble['original_text'] = text
                    bubble['translated_text'] = translated
                else:
                    bubble['original_text'] = ''
                    bubble['translated_text'] = ''
        
        return bubbles


translation_service = TranslationService()
