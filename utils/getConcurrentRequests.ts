const getConcurrentRequests = async (requestsFns, maxLimit, responses:Object[] = []) => {
    let limit = maxLimit;
    if (limit > requestsFns.length) {
        limit = requestsFns.length;
    }

    if (requestsFns.length === 0) {
        return responses;
    }

    const concurrentRequests:Function[] = [];
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