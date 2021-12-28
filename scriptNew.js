const axios = require("axios");
const mysql = require('mysql');
const pairs = [];
const dataInsert = [];
var con = mysql.createConnection({
  host: "testdev.rungila.com",
  user: "user1",
  password: "_kVvPeE(S!#[XE_85@",
  database: "arbitrage",
});


con.connect(function (err) {
  if (err) throw err;
   console.log("Connected!");
});




const init = async ()=> {
        await con.query(
          `SELECT name as exchange_type,exchange_id FROM m_exchanges order by exchange_id desc limit 2`,
          async (err, exresult) => {
            if (err) throw err;
            for(let exchange=0; exchange < exresult.length; exchange++){

                let waitLoop = new Promise(async (resolve,reject)=>{            

                    let otherExchanges = exresult.filter(function(element){            
                        return element.exchange_type !== exresult[exchange].exchange_type;
                    });

                    let parameter = {
                        baseExchange: exresult[exchange],
                        otherExchanges: otherExchanges 
                    } 

                    await getBaseExchangePair(parameter,resolve,reject);

                })

                await waitLoop;
                if(exchange == exresult.length -1){
                  if(pairs.length >=2){
                    checkCommonPairs()
                  }
                }
            } 
          }
        )
}

const getBaseExchangePair = async (values, nextLoop, loopReject) => {
  let getAllUrlConfig = {
    method: "GET",
    url: `http://localhost:5000/allPairs/${values.baseExchange.exchange_type}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  axios(getAllUrlConfig).then(async (pairsResponse) => {
    if (pairsResponse.data.data.length > 0) {      
        pairs.push({[`${values.baseExchange.exchange_type}`]:pairsResponse.data.data,exchange: values.baseExchange.exchange_type,exchange_id : values.baseExchange.exchange_id,checked:[]})
        nextLoop(0)  
    } else {
      nextLoop(0);
    }
  });
};



const checkCommonPairs = async () => {
  console.log("-------common function ------")
  for (let i = 0; i < pairs.length; i++) {
    let baseExchange = pairs[i].exchange;
    let baseExchangeId = pairs[i].exchange_id;
    let exchangePairs = pairs[i][baseExchange];
    let otherExchanges = pairs.filter(function (element) {
      return element.exchange !== baseExchange;
    });

      for (let j = 0; j < exchangePairs.length; j++) {
        let basePair = exchangePairs[j];

        for (let s = 0; s < otherExchanges.length; s++) {
          
          let otherExName = otherExchanges[s].exchange;
          let otherPairs = otherExchanges[s][otherExName];
          let otherExchangeId = otherExchanges[s].exchange_id;

            let [baseToken0, baseToken1, pairId, symbol,decimal0,decimal1] = await getObjectInfo(
              baseExchange,
              basePair
            );
  
            let [getIndex, otherPairId] = await getLoopIndex(
              baseToken0,
              baseToken1,
              otherExName,
              otherPairs
            );
  
            if (getIndex >= 0) {
              let deleteArray = otherPairs.splice(getIndex, 1);
  
              let post = `('${symbol}','${otherExchangeId}','${otherPairId}','${baseToken0}','${baseToken1}','${decimal0}','${decimal1}'),('${symbol}','${baseExchangeId}','${pairId}','${baseToken0}','${baseToken1}','${decimal0}','${decimal1}')`;
              dataInsert.push(post);
            } else {
              let [getIndexElse, otherPairIdElse] = await getLoopIndex(
                baseToken1,
                baseToken0,
                otherExName,
                otherPairs
              );
              if (getIndexElse >= 0) {
                let deleteArray = otherPairs.splice(getIndexElse, 1);
                let post = `('${symbol}','${otherExchangeId}','${otherPairIdElse}','${baseToken1}','${baseToken0}','${decimal0}','${decimal1}'),('${symbol}','${baseExchangeId}','${pairId}','${baseToken0}','${baseToken1}','${decimal0}','${decimal1}')`;
                dataInsert.push(post);
              }
            }
          
            if (i == pairs.length -1 && j == exchangePairs.length - 1 && s == otherExchanges.length -1) {
              console.log(dataInsert,"-------common function ------")
                if(dataInsert.length > 0){
                  var post = dataInsert.join();
                  var sql = `INSERT INTO m_common_pair (symbol,exchange_id,pairtoken,token0,token1,decimal0,decimal1) values ${post}`;
                  var query = con.query(sql, post, function (err, res) {
                    if (err) throw err;
                  });
                  console.log(query.sql)
                }
            }
        }
      }
    
    
  }
};


const getObjectInfo = async (exchange,exchangeData)=> {
  let token0;
  let token1;
  let pairId;
  let symbol;
  let decimal0;
  let decimal1;
  if(exchange == "PANCAKESWAP"){
    token0 = exchangeData.token0.id
    token1 = exchangeData.token1.id
    decimal0 = exchangeData.token0.decimals
    decimal1 = exchangeData.token1.decimals
    pairId = exchangeData.id
    symbol = exchangeData.token0.symbol+"/"+exchangeData.token1.symbol;
  } else if(exchange == "APESWAP") {
    token0 = exchangeData.token0.id
    token1 = exchangeData.token1.id
    decimal0 = exchangeData.token0.decimals
    decimal1 = exchangeData.token1.decimals
    pairId = exchangeData.id
    symbol = exchangeData.token0.symbol+"/"+exchangeData.token1.symbol;
  } 

  return [token0,token1,pairId,symbol,decimal0,decimal1]
}

const getLoopIndex = async (token0,token1,exchange,otherPairs) => {

  let index;
  let pairId;
  if(exchange == "PANCAKESWAP"){
    index = otherPairs.findIndex((otherPair) => otherPair.token0.id.toLowerCase() === token0.toLowerCase() && otherPair.token1.id.toLowerCase() === token1.toLowerCase());
    if(index >= 0){      
      pairId = otherPairs[index].id
    }
  } else if(exchange == "APESWAP") {
    index = otherPairs.findIndex((otherPair) => otherPair.token0.id.toLowerCase() === token0.toLowerCase() && otherPair.token1.id.toLowerCase() === token1.toLowerCase());
    if(index >= 0){
      pairId = otherPairs[index].id
    }
  } 

  return [index,pairId]
}


init()