import re
import math
from collections import Counter

# Set of common English and simple international stopwords to filter during keyword extraction
STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can',
    'will', 'just', 'don', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
    'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'this', 'that', 'these', 'those', 'am', 'has', 'have', 'had', 'having', 'do',
    'does', 'did', 'doing', 'would', 'should', 'could', 'ought', 'i\'m', 'you\'re', 'he\'s',
    'she\'s', 'it\'s', 'we\'re', 'they\'re', 'i\'ve', 'you\'ve', 'we\'ve', 'they\'ve', 'i\'d',
    'you\'d', 'he\'d', 'she\'d', 'we\'d', 'they\'d', 'i\'ll', 'you\'ll', 'he\'ll', 'she\'ll',
    'we\'ll', 'they\'ll', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t',
    'hadn\'t', 'doesn\'t', 'don\'t', 'didn\'t', 'won\'t', 'wouldn\'t', 'shan\'t', 'shouldn\'t',
    'can\'t', 'cannot', 'couldn\'t', 'mustn\'t', 'let\'s', 'that\'s', 'who\'s', 'what\'s',
    'here\'s', 'there\'s', 'when\'s', 'where\'s', 'why\'s', 'how\'s', 'd', 'll', 'm', 'o', 're',
    've', 'y', 'please', 'thanks', 'also', 'using', 'used', 'use', 'would', 'well', 'many'
}

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes file name, replacing spaces with underscores and stripping non-alphanumeric/dot characters.
    """
    # Keep only alphanumeric, dots, underscores, and dashes
    filename = filename.strip().replace(" ", "_")
    return re.sub(r'(?u)[^-\w.]', '', filename)

def format_bytes(size_bytes: int) -> str:
    """
    Formats byte size to human-readable string.
    """
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

def calculate_reading_time(text: str, wpm: int = 200) -> int:
    """
    Calculates reading time in minutes based on average words per minute.
    Min reading time returned is 1 minute.
    """
    words = re.findall(r'\w+', text)
    word_count = len(words)
    minutes = math.ceil(word_count / wpm)
    return max(1, minutes)

def get_top_keywords(text: str, top_n: int = 10) -> list[str]:
    """
    Extracts top keywords from text using frequency count, filtering out stopwords and numbers.
    """
    # Extract words, make lowercase
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Filter stopwords
    filtered_words = [w for w in words if w not in STOPWORDS]
    
    # Count frequencies
    counter = Counter(filtered_words)
    return [item[0] for item in counter.most_common(top_n)]

def detect_language(text: str) -> str:
    """
    Lightweight rule-based language detector using common function words.
    """
    text_lower = text.lower()
    words = re.findall(r'\b[a-z]{2,5}\b', text_lower)
    if not words:
        return "English"
        
    counts = {
        "English": 0,
        "Spanish": 0,
        "French": 0,
        "German": 0,
        "Italian": 0
    }
    
    # Vocabulary markers
    markers = {
        "English": {"the", "and", "of", "with", "that", "this", "for", "have", "you"},
        "Spanish": {"el", "la", "los", "las", "y", "en", "que", "un", "una", "del", "por", "para"},
        "French": {"le", "la", "les", "et", "en", "que", "dans", "pour", "des", "une", "est"},
        "German": {"der", "die", "das", "und", "in", "ist", "mit", "von", "ein", "eine", "zu"},
        "Italian": {"il", "la", "i", "gli", "le", "e", "in", "di", "che", "un", "una", "per"}
    }
    
    word_set = set(words[:500]) # Sample first 500 words for speed
    
    for lang, mark_set in markers.items():
        counts[lang] = len(word_set.intersection(mark_set))
        
    best_lang = max(counts, key=counts.get)
    if counts[best_lang] == 0:
        return "English" # Default fallback
    return best_lang
