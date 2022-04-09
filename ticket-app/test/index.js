describe("Market", function () {
  it("It should create events, tickets, and execute ticket sales", async function () {
    const Market = await ethers.getContractFactory("TicketMarket");
    const market = await Market.deploy();
    await market.deployed();
    const marketAddress = market.address;

    const NFT = await ethers.getContractFactory("NFTTicket");
    const nft = await NFT.deploy(marketAddress);
    await nft.deployed();
    const nftContract = nft.address;

    //A way to get test addresses. The first address is the deployment address so we ignore it with a "_"
    const [_, buyerAddress, buyerAddress2, sellerAddress, sellerAddress2] =
      await ethers.getSigners();

    //this method allows us to deal with whole units instead of wei. In here its not 100 ether, its 100 matic (1MATIC = 1.3GBP).
    const ticketPrice = ethers.utils.parseUnits("100", "ether");
    const maxPrice = ethers.utils.parseUnits("150", "ether");
    const resalePrice = ethers.utils.parseUnits("150", "ether");
    //your_string

    /*
    string name,
    string description,
    string imageUri,
    string location,
    uint64 eventStartDate
    */

    const createEventEvent = await market
      .connect(sellerAddress)
      .createEvent(
        "url/event/1.json",
        Math.floor(new Date("2022-04-08, 23:59:59").getTime() / 1000)
      );
    let eventId = await createEventEvent.wait();
    console.log("EVENT 1", eventId.events[0].args);
    eventId = eventId.events[0].args.eventId.toNumber();
    //await market.connect(sellerAddress).setEventUri(eventId, "url/event/1.json");

    let getEvent = await market.connect(buyerAddress).getEvent(1);
    getEvent = {
      eventId: getEvent.eventId.toString(),
      uri: getEvent.uri,
      startDate: new Date(
        getEvent.startDate.toNumber() * 1000
      ).toLocaleDateString(),
      owner: getEvent.owner,
    };

    console.log("Get event: ", getEvent);

    const createEventEvent2 = await market
      .connect(sellerAddress2)
      .createEvent(
        "url/event/2.json",
        Math.floor(new Date("2022-12-23").getTime() / 1000)
      );
    let eventId2 = await createEventEvent2.wait();
    console.log("EVENT 2", eventId2.events[0].args);
    eventId2 = eventId2.events[0].args.eventId.toNumber();
    //await market.connect(sellerAddress2).setEventUri(eventId2, "url/event/2.json");

    const createTokenEvent = await nft.connect(sellerAddress).createToken(10);
    let tokenId = await createTokenEvent.wait();
    tokenId.events.forEach((element) => {
      if (element.event == "NFTTicketCreated") {
        tokenId = element.args.tokenId.toNumber();
      }
    });
    await nft.connect(sellerAddress).setTokenUri(1, "url/1.json");
    const nftURI = await nft.uri(1);
    console.log("URI For Token ID 1 =", nftURI);

    await market
      .connect(sellerAddress)
      .createMarketTicket(
        eventId,
        tokenId,
        nftContract,
        4,
        10,
        ticketPrice,
        10,
        maxPrice
      );

    await market
      .connect(buyerAddress)
      .buyTicket(nftContract, tokenId, 2, { value: ticketPrice.mul(2) });

    const myNfts = await nft.balanceOf(buyerAddress.address, tokenId);
    console.log("Buyer's NFTs = ", myNfts.toString());
    let allEvents = await market.getAllEvents();
    allEvents = await Promise.all(
      allEvents.map(async (i) => {
        let _event = {
          eventId: i.eventId.toString(),
          uri: i.uri,
          startDate: new Date(
            i.startDate.toNumber() * 1000
          ).toLocaleDateString(),
          ticketTotal: i.ticketTotal.toNumber(),
          ticketsSold: i.ticketsSold.toNumber(),
          owner: i.owner,
        };
        return _event;
      })
    );
    console.log("All Events: ", allEvents);

    let myEvents = await market.connect(sellerAddress).getMyEvents();
    myEvents = await Promise.all(
      myEvents.map(async (i) => {
        let _event = {
          eventId: i.eventId.toString(),
          uri: i.uri,
          startDate: new Date(
            i.startDate.toNumber() * 1000
          ).toLocaleDateString(),
          ticketTotal: i.ticketTotal.toNumber(),
          ticketsSold: i.ticketsSold.toNumber(),
          owner: i.owner,
        };
        return _event;
      })
    );
    console.log("My Events: ", myEvents);

    let myTickets = await market
      .connect(buyerAddress)
      .getMyTickets(nftContract);

    /**    uint256 tokenId;
    uint eventId;
    address payable seller;
    address payable owner;
    uint256 price;
    uint256 purchaseLimit;
    uint256 totalSupply;
    bool sold; */
    myTickets = await Promise.all(
      myTickets.map(async (i) => {
        let price = ethers.utils.formatUnits(i.price.toString(), "ether");
        let maxResalePrice = ethers.utils.formatUnits(
          i.maxResalePrice.toString(),
          "ether"
        );
        let qty = await nft.balanceOf(
          buyerAddress.address,
          i.tokenId.toNumber()
        );
        let _ticket = {
          tokenId: i.tokenId.toString(),
          eventId: i.eventId.toString(),
          price: `${price} MATIC`,
          quantity: qty.toNumber(),
          purchaseLimit: i.purchaseLimit.toString(),
          totalSupply: i.totalSupply.toString(),
          royaltyFee: `${i.royaltyFee.toString()}%`,
          maxResalePrice: `${maxResalePrice} MATIC`,
        };
        return _ticket;
      })
    );
    console.log("My tickets: ", myTickets);

    await market
      .connect(sellerAddress)
      .validateTicket(nftContract, buyerAddress.address, 1);

    //EXPLANATION - https://ethereum.stackexchange.com/questions/117944/why-do-i-keep-receiving-this-error-revert-erc721-transfer-caller-is-not-owner
    //You need to give the market approval again for some reason before being able to resale ticket
    await nft.connect(buyerAddress).giveResaleApproval(1);
    const listForResealEvent = await market
      .connect(buyerAddress)
      .listOnResale(nftContract, 1, resalePrice);
    let resaleId = await listForResealEvent.wait();
    resaleId.events.forEach((element) => {
      if (element.event == "ResaleTicketCreated") {
        resaleId = element.args.resaleId.toNumber();
      }
    });
    console.log("resaleId = ", resaleId);

    let myResaleListings = await market
      .connect(buyerAddress)
      .getMyResaleListings();
    myResaleListings = await Promise.all(
      myResaleListings.map(async (i) => {
        let price = ethers.utils.formatUnits(i.resalePrice.toString(), "ether");
        let _ticket = {
          resaleId: i.resaleId.toString(),
          tokenId: i.tokenId.toString(),
          seller: i.seller,
          price: `${price} MATIC`,
          sold: i.sold,
        };
        return _ticket;
      })
    );
    console.log("My Resale Listings: ", myResaleListings);

    let resaleTickets = await market.getResaleTickets(1);

    // struct ResaleTicket {
    //   uint256 resaleId;
    //   uint256 tokenId;
    //   address payable seller;
    //   uint256 resalePrice;
    // }
    resaleTickets = await Promise.all(
      resaleTickets.map(async (i) => {
        let price = ethers.utils.formatUnits(i.resalePrice.toString(), "ether");
        let _ticket = {
          resaleId: i.resaleId.toString(),
          tokenId: i.tokenId.toString(),
          seller: i.seller,
          price: `${price} MATIC`,
          sold: i.sold,
        };
        return _ticket;
      })
    );
    console.log("Resale tickets: ", resaleTickets);

    await market
      .connect(buyerAddress2)
      .buyResaleTicket(nftContract, resaleId, { value: resalePrice });

    resaleTickets = await market.getResaleTickets(1);
    resaleTickets = await Promise.all(
      resaleTickets.map(async (i) => {
        let price = ethers.utils.formatUnits(i.resalePrice.toString(), "ether");
        let _ticket = {
          resaleId: i.resaleId.toString(),
          tokenId: i.tokenId.toString(),
          seller: i.seller,
          resalePrice: `${price} MATIC`,
          sold: i.sold,
        };
        return _ticket;
      })
    );
    console.log("Resale tickets after purchase: ", resaleTickets);

    const newResalePrice = ethers.utils.parseUnits("125", "ether");
    await nft.connect(buyerAddress2).giveResaleApproval(1);
    const listForResellEvent2 = await market
      .connect(buyerAddress2)
      .listOnResale(nftContract, 1, newResalePrice);
    resaleId = await listForResellEvent2.wait();
    resaleId.events.forEach((element) => {
      if (element.event == "ResaleTicketCreated") {
        resaleId = element.args.resaleId.toNumber();
      }
    });
    console.log("resaleId = ", resaleId);

    resaleTickets = await market.getResaleTickets(1);
    resaleTickets = await Promise.all(
      resaleTickets.map(async (i) => {
        let price = ethers.utils.formatUnits(i.resalePrice.toString(), "ether");
        let _ticket = {
          resaleId: i.resaleId.toString(),
          tokenId: i.tokenId.toString(),
          seller: i.seller,
          resalePrice: `${price} MATIC`,
          sold: i.sold,
        };
        return _ticket;
      })
    );
    console.log("Resale tickets after new resale: ", resaleTickets);
    console.log(new Date(1649422882 * 1000).toLocaleString());
    const myDate = new Date("04/08/22, 23:59:59").toLocaleString();
    console.log(myDate.toLocaleString());
  });
});
