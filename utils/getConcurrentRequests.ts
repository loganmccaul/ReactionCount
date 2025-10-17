/**
 * Concurrent Request Utility
 * 
 * Executes async functions in batches with configurable concurrency limits to prevent 
 * overwhelming APIs with rate limits. Recursively processes remaining requests while 
 * accumulating results and handling failures gracefully.
 * 
 * Kept generic to handle any array of promises.
 */
import { setTimeout } from "timers/promises";

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

    let remainingRequests: AsyncFunction<T>[] = [];
    await Promise.allSettled(concurrentRequests).then(concurrentRequestResponses => {
        concurrentRequestResponses.forEach((response, i) => {
            if (response.status === 'rejected') {
                remainingRequests.push(requestsFns[i]);
            } else {
                responses.push(response.value);
            }
        });
    });

    console.log(`${responses.length} responses received so far, ${remainingRequests.length} requests failed and will be retried.`);
    if (remainingRequests.length > 0) {
        console.log('Waiting 15 seconds before retrying failed requests...');
        await setTimeout(15000); // Wait 15 seconds before retrying failed requests
    }

    remainingRequests = [...remainingRequests, ...requestsFns.slice(limit)];

    return getConcurrentRequests(remainingRequests, limit, responses);
}

export default getConcurrentRequests;