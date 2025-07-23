import Filter from 'bad-words'

const filter = new Filter()

export function isExplicit(text) {
    return filter.isProfane(text)
}

export function cleanText(text) {
    return filter.clean(text)
}