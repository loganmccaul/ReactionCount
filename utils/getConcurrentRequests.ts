/**
 * Concurrent Request Utility
 * 
 * Executes async functions in batches with configurable concurrency limits to prevent 
 * overwhelming APIs with rate limits. Recursively processes remaining requests while 
 * accumulating results and handling failures gracefully.
 * 
 * Kept generic to handle any array of promises.
 */

export type AsyncFunction<T> = () => Promise<T>;
const getConcurrentRequests = async <T>(requestsFns: AsyncFunction<T>[], maxLimit: number, responses: T[] = []): Promise<T[]> => {
    let limit = maxLimit;
    if (limit > requestsFns.length) {
        limit = requestsFns.length;
    }

    if (requestsFns.length === 0) {
        return responses;
    }

    const concurrentRequests: Promise<T>[] = [];
    for (let i = 0; i < limit; i++) {
        concurrentRequests.push(requestsFns[i]());
    }
    await Promise.allSettled(concurrentRequests).then(concurrentRequestResponses => {
        concurrentRequestResponses.forEach(response => {
            if (response.status === 'rejected') {
                console.log('Rejected: ', response)
            } else {
                responses.push(response.value);
            }
        });
    });


    const remainingRequests = requestsFns.slice(limit);

    return getConcurrentRequests(remainingRequests, limit, responses);
}

export default getConcurrentRequests;